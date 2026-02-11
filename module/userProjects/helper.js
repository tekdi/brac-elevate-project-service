/**
 * name : helper.js
 * author : Aman
 * created-date : 16-July-2020
 * Description : Projects helper functionality.
 */

// Dependencies
const libraryCategoriesHelper = require(MODULES_BASE_PATH + '/library/categories/helper')
const projectTemplatesHelper = require(MODULES_BASE_PATH + '/project/templates/helper')
const { v4: uuidv4 } = require('uuid')
const projectQueries = require(DB_QUERY_BASE_PATH + '/projects')
const projectCategoriesQueries = require(DB_QUERY_BASE_PATH + '/projectCategories')
const projectTemplateQueries = require(DB_QUERY_BASE_PATH + '/projectTemplates')
const projectTemplateTaskQueries = require(DB_QUERY_BASE_PATH + '/projectTemplateTask')
const kafkaProducersHelper = require(GENERICS_FILES_PATH + '/kafka/producers')
const removeFieldsFromRequest = ['submissionDetails']
const programsQueries = require(DB_QUERY_BASE_PATH + '/programs')
const userService = require(GENERICS_FILES_PATH + '/services/users')
const solutionsHelper = require(MODULES_BASE_PATH + '/solutions/helper')
const programsHelper = require(MODULES_BASE_PATH + '/programs/helper')
const certificateTemplateQueries = require(DB_QUERY_BASE_PATH + '/certificateTemplates')
const certificateValidationsHelper = require(MODULES_BASE_PATH + '/certificateValidations/helper')
const programUsersQueries = require(DB_QUERY_BASE_PATH + '/programUsers')
const solutionsQueries = require(DB_QUERY_BASE_PATH + '/solutions')
const programQueries = require(DB_QUERY_BASE_PATH + '/programs')
const entitiesService = require(GENERICS_FILES_PATH + '/services/entity-management')
const common_handler = require(GENERICS_FILES_PATH + '/helpers/common_handler')
const cloudServicesHelper = require(MODULES_BASE_PATH + '/cloud-services/files/helper')
const axios = require('axios')
const fs = require('fs')
const QRCode = require('qrcode')
const path = require('path')
const gotenbergService = require(SERVICES_BASE_PATH + '/gotenberg')
const projectService = require(SERVICES_BASE_PATH + '/projects')
const defaultUserProfileConfig = require('@config/defaultUserProfileDeleteConfig')
const configFilePath = process.env.AUTH_CONFIG_FILE_PATH
const surveyService = require(SERVICES_BASE_PATH + '/survey')
const programUsersService = require(SERVICES_BASE_PATH + '/programUsers')
const ObjectId = global.ObjectId || require('mongoose').Types.ObjectId

/**
 * UserProjectsHelper
 * @class
 */

module.exports = class UserProjectsHelper {
	/**
	 * Projects boolean data.
	 * @method
	 * @name booleanData
	 * @returns {Array} Boolean data.
	 */

	static booleanData() {
		const projectsSchema = schemas['projects'].schema
		const projectSchemaKey = Object.keys(projectsSchema)

		let booleanProjects = []

		projectSchemaKey.forEach((projectSchema) => {
			const currentSchema = projectsSchema[projectSchema]

			if (currentSchema.hasOwnProperty('default') && typeof currentSchema.default === 'boolean') {
				booleanProjects.push(projectSchema)
			}
		})

		return booleanProjects
	}

	/**
	 * Projects object id field.
	 * @method
	 * @name mongooseIdData
	 * @returns {Array} Projects object id field.
	 */

	static mongooseIdData() {
		const projectsSchema = schemas['projects'].schema
		const projectSchemaKey = Object.keys(projectsSchema)

		let mongooseIds = []

		projectSchemaKey.forEach((projectSchema) => {
			const currentSchemaType = projectsSchema[projectSchema]

			if (currentSchemaType === 'ObjectId') {
				mongooseIds.push(projectSchema)
			}
		})

		return mongooseIds
	}

	/**
	 * Sync project.
	 * @method
	 * @name sync
	 * @param {String} projectId - id of the project.
	 * @param {String} lastDownloadedAt - last downloaded at time.
	 * @param {Object} data - body data.
	 * @param {String} userId - Logged in user id.
	 * @param {String} userDetails - loggedin user's info.
	 * @param {String} [appName = ""] - App Name.
	 * @param {String} [appVersion = ""] - App Version.
	 * @param {boolean} invokedViaUpdateApi - Indicates if the function is called via the Update API.
	 * When true, it bypasses certain restrictions (e.g., submitted status, timestamp mismatch) to allow updates like reflection data.
	 * @param {boolean} invokedViaUpdateApi - Indicates if the function is called via the Update API.
	 * When true, it bypasses certain restrictions (e.g., submitted status, timestamp mismatch) to allow updates like reflection data.
	 * When false, stricter validations are enforced for normal sync operations.
	 * @returns {Object} Project created information.
	 */

	static sync(
		projectId,
		lastDownloadedAt,
		data,
		userId,
		userDetails,
		appName = '',
		appVersion = '',
		invokedViaUpdateApi = false
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				const userProject = await projectQueries.projectDocument(
					{
						_id: projectId,
						tenantId: tenantId,
					},
					[
						'_id',
						'tasks',
						'taskSequence',
						'programInformation._id',
						'solutionInformation._id',
						'solutionInformation.externalId',
						'entityInformation._id',
						'lastDownloadedAt',
						'appInformation',
						'status',
						'updateHistory',
						'acl',
						'userId',
						'reflection',
					]
				)

				if (!(userProject.length > 0)) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
					}
				}

				// if entityId & entityInformation are passed through payload, ignore them
				const blackListedPayloadItems = ['entityId', 'entityInformation']
				blackListedPayloadItems.map((payloadItem) => {
					if (data.hasOwnProperty(payloadItem)) delete data[payloadItem]
				})

				if (process.env.SUBMISSION_LEVEL == 'USER') {
					if (!(userProject[0].userId == userId)) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
						}
					}
				} else {
					// validate user authenticity if the acl.visibility of project is SELf or SPECIFIC
					if (
						(userProject[0].acl.visibility == CONSTANTS.common.PROJECT_VISIBILITY_SELF &&
							!(userProject[0].userId == userId)) ||
						(userProject[0].acl.visibility == CONSTANTS.common.PROJECT_VISIBILITY_SPECIFIC &&
							!(userProject[0].acl.hasOwnProperty('users') && userProject[0].acl.users.includes(userId)))
					) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.USER_NOT_ALLOWED_TO_EDIT_PROJECT,
						}
					}
					// validate user authenticity if the acl.visibility of project is SCOPE
					else if (userProject[0].acl.visibility == CONSTANTS.common.PROJECT_VISIBILITY_SCOPE) {
						let scopeData = data.userProfileInformation.scope
						let queryData = await solutionsHelper.queryBasedOnRoleAndLocation(scopeData, '', 'acl')
						if (!queryData.success) {
							return resolve(queryData)
						}
						delete queryData.data.isReusable
						delete queryData.data.isDeleted
						delete queryData.data.status
						let matchQuery = {}
						matchQuery = queryData.data
						matchQuery['tenantId'] = tenantId
						let projects = await projectQueries.projectDocument(matchQuery, 'all')
						if (!Array.isArray(projects) || projects.length < 1) {
							throw {
								status: HTTP_STATUS_CODE.bad_request.status,
								message: CONSTANTS.apiResponses.USER_NOT_ALLOWED_TO_EDIT_PROJECT,
							}
						}
					}
				}

				if (!invokedViaUpdateApi && userProject[0].lastDownloadedAt.toISOString() !== lastDownloadedAt) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_ALREADY_SYNC,
					}
				}

				if (!invokedViaUpdateApi && userProject[0].status == CONSTANTS.common.SUBMITTED_STATUS) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.FAILED_TO_SYNC_PROJECT_ALREADY_SUBMITTED,
					}
				}

				let currentReflection = userProject[0].reflection || {}

				if (data.reflectionStatus == CONSTANTS.common.STARTED) {
					currentReflection.status = CONSTANTS.common.STARTED
					currentReflection.startDate = new Date()
					data.reflection = currentReflection
				} else if (data.reflectionStatus == CONSTANTS.common.COMPLETED_STATUS) {
					currentReflection.status = CONSTANTS.common.COMPLETED_STATUS
					currentReflection.endDate = new Date()
					data.reflection = currentReflection
				}

				if (
					data.status &&
					![
						CONSTANTS.common.COMPLETED_STATUS,
						CONSTANTS.common.INPROGRESS_STATUS,
						CONSTANTS.common.SUBMITTED_STATUS,
						CONSTANTS.common.STARTED,
					].includes(data.status)
				) {
					throw {
						message: CONSTANTS.apiResponses.INVALID_PROJECT_STATUS,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				if (invokedViaUpdateApi && userProject[0].status == CONSTANTS.common.SUBMITTED_STATUS) {
					let projectUpdated = await projectQueries.findOneAndUpdate(
						{
							_id: userProject[0]._id,
							tenantId: tenantId,
						},
						{
							$set: {
								reflection: data.reflection,
							},
						},
						{
							new: true,
						}
					)

					if (!projectUpdated._id) {
						throw {
							message: CONSTANTS.apiResponses.USER_PROJECT_NOT_UPDATED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}

					return resolve({
						success: true,
						message: CONSTANTS.apiResponses.USER_PROJECT_UPDATED,
					})
				}

				const projectsModel = Object.keys(schemas['projects'].schema)

				let keysToRemoveFromUpdation = ['userRoleInformation', 'userProfile', 'certificate']
				keysToRemoveFromUpdation.forEach((key) => {
					if (data[key]) delete data[key]
				})

				let updateProject = {}
				if (data.solutionId) {
					const solutionInformation = await solutionsQueries.solutionsDocument({
						_id: data.solutionId,
						tenantId: tenantId,
					})
					if (solutionInformation.length > 0) {
						updateProject.solutionInformation = solutionInformation[0]
					}
				}
				if (data.programId) {
					const programInformation = await programQueries.programsDocument({
						_id: data.programId,
						tenantId: tenantId,
					})
					if (programInformation.length > 0) {
						updateProject.programInformation = programInformation[0]
					}
				}
				let projectData = await _projectData(data, tenantId, orgId)
				if (projectData && projectData.success == true) {
					updateProject = _.merge(updateProject, projectData.data)
				}
				// let createNewProgramAndSolution = false;
				// let solutionExists = false;

				// if (data.programId && data.programId !== "") {

				//     // Check if program already existed in project and if its not an existing program.
				//     if (!userProject[0].programInformation) {
				//         createNewProgramAndSolution = true;
				//     } else if (
				//         userProject[0].programInformation &&
				//         userProject[0].programInformation._id &&
				//         userProject[0].programInformation._id.toString() !== data.programId
				//     ) {
				//         // Not an existing program.

				//         solutionExists = true;
				//     }

				// } else if (data.programName) {

				//     if (!userProject[0].solutionInformation) {
				//         createNewProgramAndSolution = true;
				//     } else {
				//         solutionExists = true;
				//         // create new program using current name and add existing solution and remove program from it.
				//     }
				// }

				// if (createNewProgramAndSolution || solutionExists) {

				//     let programAndSolutionInformation =
				//         await this.createProgramAndSolution(
				//             data.programId,
				//             data.programName,
				//             updateProject.entityId ? [updateProject.entityId] : "",
				//             userToken,
				//             userProject[0].solutionInformation && userProject[0].solutionInformation._id ?
				//                 userProject[0].solutionInformation._id : ""
				//         );

				//     if (!programAndSolutionInformation.success) {
				//         return resolve(programAndSolutionInformation);
				//     }

				//     if (solutionExists) {

				//         let updateProgram =
				//             await programsHelper.removeSolutions(
				//                 userToken,
				//                 userProject[0].programInformation._id,
				//                 [userProject[0].solutionInformation._id]
				//             );

				//         if (!updateProgram.success) {
				//             throw {
				//                 status: HTTP_STATUS_CODE.bad_request.status,
				//                 message: CONSTANTS.apiResponses.PROGRAM_NOT_UPDATED
				//             }
				//         }
				//     }

				//     updateProject =
				//         _.merge(updateProject, programAndSolutionInformation.data);
				// }

				let booleanData = this.booleanData(schemas['projects'].schema)
				let mongooseIdData = this.mongooseIdData(schemas['projects'].schema)

				if (data.tasks) {
					let taskReport = {}

					updateProject.tasks = await _projectTask(data.tasks, false, '', '', data.programId, userDetails)

					// Add metaInformation for custom tasks right after _projectTask processing
					updateProject.tasks.forEach((task) => {
						if (task.isACustomTask === true || task.isACustomTask === 'true') {
							if (!task.metaInformation) {
								task.metaInformation = {}
							}
							// Use buttonLabel from request if present, else default to "Upload"
							task.metaInformation.buttonLabel = task.metaInformation.buttonLabel || 'Upload'
							// Use icon from request if present, else default to "Upload"
							task.metaInformation.icon = task.metaInformation.icon || 'Upload'
						}
					})

					if (userProject[0].tasks && userProject[0].tasks.length > 0) {
						// Helper function to recursively find a task by _id in nested structure
						// This searches in both existing tasks and newly processed tasks
						const findTaskById = (tasks, taskId) => {
							for (let i = 0; i < tasks.length; i++) {
								// Compare as strings to handle ObjectId vs string
								if (String(tasks[i]._id) === String(taskId)) {
									return tasks[i]
								}
								// Recursively search in children
								if (tasks[i].children && tasks[i].children.length > 0) {
									const found = findTaskById(tasks[i].children, taskId)
									if (found) {
										return found
									}
								}
							}
							return null
						}

						// Helper function to add child to parent's children array and update taskSequence
						const addChildToParent = (parentTask, childTask) => {
							// Initialize children array if it doesn't exist
							if (!parentTask.children) {
								parentTask.children = []
							}

							// Check if child already exists in parent's children
							const childIndex = parentTask.children.findIndex(
								(child) => String(child._id) === String(childTask._id)
							)

							if (childIndex < 0) {
								// Add child to parent's children array
								parentTask.children.push(childTask)

								// Initialize taskSequence if it doesn't exist
								if (!parentTask.taskSequence) {
									parentTask.taskSequence = []
								}

								// Add child's externalId to parent's taskSequence if not already present
								if (childTask.externalId && !parentTask.taskSequence.includes(childTask.externalId)) {
									parentTask.taskSequence.push(childTask.externalId)
								}
								return true
							} else {
								// Child already exists, update it
								parentTask.children[childIndex] = childTask
								// Ensure externalId is in taskSequence
								if (!parentTask.taskSequence) {
									parentTask.taskSequence = []
								}
								if (childTask.externalId && !parentTask.taskSequence.includes(childTask.externalId)) {
									parentTask.taskSequence.push(childTask.externalId)
								}
								return true
							}
						}

						// Process tasks in two passes:
						// Pass 1: Merge all tasks first (so we can find parents that are also being updated)
						// Pass 2: Handle parent-child relationships

						// Helper function to recursively find and update a task by _id at any nesting level
						const findAndUpdateTaskRecursively = (tasks, taskToUpdate) => {
							for (let i = 0; i < tasks.length; i++) {
								// Compare as strings to handle ObjectId vs string
								if (String(tasks[i]._id) === String(taskToUpdate._id)) {
									// Found the task - update it
									let keepFieldsFromTask = ['observationInformation', 'submissions']

									removeFieldsFromRequest.forEach((removeField) => {
										delete tasks[i][removeField]
									})

									keepFieldsFromTask.forEach((field) => {
										if (tasks[i][field]) {
											taskToUpdate[field] = tasks[i][field]
										}
									})

									// Merge existing task data with updates
									tasks[i] = {
										...tasks[i],
										...taskToUpdate,
										updatedBy: userId,
										updatedAt: new Date(),
									}
									return true
								}
								// Recursively search in children
								if (tasks[i].children && tasks[i].children.length > 0) {
									if (findAndUpdateTaskRecursively(tasks[i].children, taskToUpdate)) {
										return true
									}
								}
							}
							return false
						}

						// First pass: Merge tasks into userProject[0].tasks (recursively find and update existing tasks)
						updateProject.tasks.forEach((task) => {
							task.updatedBy = userId
							task.updatedAt = new Date()

							// Normalize parentId (handle space before parentId if present)
							if (task[' parentId']) {
								task.parentId = task[' parentId']
								delete task[' parentId']
							}

							// Try to find and update the task recursively (at any nesting level)
							const taskFound = findAndUpdateTaskRecursively(userProject[0].tasks, task)

							if (!taskFound) {
								// Task not found - it's a new task, treat as custom task
								// Mark as custom task if not already set
								if (task.isACustomTask !== true && task.isACustomTask !== 'true') {
									task.isACustomTask = true
								}

								// Add metaInformation for all new custom tasks
								if (!task.metaInformation) {
									task.metaInformation = {}
								}
								// Use buttonLabel from request if present, else default to "Upload"
								task.metaInformation.buttonLabel = task.metaInformation.buttonLabel || 'Upload'
								// Use icon from request if present, else default to "Upload"
								task.metaInformation.icon = task.metaInformation.icon || 'Upload'

								userProject[0].tasks.push(task)
							}
						})

						// Second pass: Handle parent-child relationships and update root taskSequence
						// Now that all tasks are merged, we can find parents at any level

						// Initialize root taskSequence if it doesn't exist
						if (!userProject[0].taskSequence) {
							userProject[0].taskSequence = []
						}

						updateProject.tasks.forEach((task) => {
							if (task.parentId) {
								// Find parent task recursively in the merged structure
								// This will find parents at any nesting level (root, child, grandchild, etc.)
								const parentTask = findTaskById(userProject[0].tasks, task.parentId)

								if (parentTask) {
									// Add child to parent's children array and update taskSequence
									addChildToParent(parentTask, task)
								}
							} else {
								// Root-level task (no parentId) - add to project's root taskSequence
								if (task.externalId && !userProject[0].taskSequence.includes(task.externalId)) {
									userProject[0].taskSequence.push(task.externalId)
								}
							}
						})

						updateProject.tasks = userProject[0].tasks
						// Update root taskSequence in updateProject
						updateProject.taskSequence = userProject[0].taskSequence
					}

					taskReport.total = updateProject.tasks.length

					updateProject.tasks.forEach((task) => {
						//consider tasks where isDeleted is false.
						if (task.isDeleted == false) {
							if (!taskReport[task.status]) {
								taskReport[task.status] = 1
							} else {
								taskReport[task.status] += 1
							}
						} else {
							taskReport.total = taskReport.total - 1
						}
					})

					updateProject['taskReport'] = taskReport
				}
				Object.keys(data).forEach((updateData) => {
					if (!updateProject[updateData] && projectsModel.includes(updateData)) {
						if (booleanData.includes(updateData)) {
							updateProject[updateData] = UTILS.convertStringToBoolean(data[updateData])
						} else if (mongooseIdData.includes(updateData)) {
							updateProject[updateData] = ObjectId(data[updateData])
						} else {
							updateProject[updateData] = data[updateData]
						}
					}
				})

				updateProject.updatedBy = userId
				updateProject.updatedAt = new Date()

				if (!userProject[0].appInformation) {
					updateProject['appInformation'] = {}

					if (appName !== '') {
						updateProject['appInformation']['appName'] = appName
					}

					if (appVersion !== '') {
						updateProject['appInformation']['appVersion'] = appVersion
					}
				}

				// if ( data.status && data.status !== "" ) {
				//    updateProject.status = UTILS.convertProjectStatus(data.status);
				// }

				if (
					data.status == CONSTANTS.common.COMPLETED_STATUS ||
					data.status == CONSTANTS.common.SUBMITTED_STATUS
				) {
					updateProject.completedDate = new Date()
				}
				if (userProject[0].updateHistory) {
					// maintain history of project edits
					userProject[0].updateHistory.push({
						userId: userId,
						timeStamp: new Date(),
					})
					updateProject['updateHistory'] = userProject[0].updateHistory
				}

				let projectUpdated = await projectQueries.findOneAndUpdate(
					{
						_id: userProject[0]._id,
						tenantId: tenantId,
					},
					{
						$set: updateProject,
					},
					{
						new: true,
					}
				)

				if (!projectUpdated._id) {
					throw {
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_UPDATED,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}
				let kafkaUserProject = {
					userId: userId,
					projects: projectUpdated,
				}

				//  push project details to kafka
				await this.attachEntityInformationIfExists(projectUpdated)
				const kafkaPushedProject = await kafkaProducersHelper.pushProjectToKafka(projectUpdated)
				const kafkaPushedUserProjects = await kafkaProducersHelper.pushUserActivitiesToKafka(kafkaUserProject)
				// update submission data for project as task
				if (updateProject.project && updateProject.referenceFrom === CONSTANTS.common.PROJECT) {
					let updateTaskSubmissionData = {
						_id: projectUpdated._id,
						status: data.status,
						completedDate: updateProject.completedDate ? updateProject.completedDate : '',
					}
					await this.pushSubmissionToTask(
						updateProject.project._id,
						updateProject.project.taskId,
						updateTaskSubmissionData
					)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.USER_PROJECT_UPDATED,
					data: {
						programId:
							projectUpdated.programInformation && projectUpdated.programInformation._id
								? projectUpdated.programInformation._id
								: '',
						hasAcceptedTAndC: projectUpdated.hasAcceptedTAndC ? projectUpdated.hasAcceptedTAndC : false,
					},
					result: {
						programId:
							projectUpdated.programInformation && projectUpdated.programInformation._id
								? projectUpdated.programInformation._id
								: '',
						hasAcceptedTAndC: projectUpdated.hasAcceptedTAndC ? projectUpdated.hasAcceptedTAndC : false,
					},
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Program and solution information
	 * @method
	 * @name createProgramAndSolution
	 * @param {String} entityId - entity id.
	 * @param {String} userToken - Logged in user token.
	 * @param {String} [ programId = "" ] - Program Id.
	 * @param {String} [ programName = "" ] - Program Name.
	 * @param {Array} entities - List of entity IDs.
	 * @param {String} userId - Logged in user id.
	 * @param {String} solutionId - Solution id.
	 * @param {Boolean|String} [ isATargetedSolution = "" ] - Flag to check if it is a targeted solution.
	 * @param {Object} userDetails - User details object.
	 * @param {Boolean} isExternalProgram - Flag to check if it is an external program.
	 * @returns {Object} Created program and solution data.
	 * @returns {Object} Created program and solution data.
	 */

	static createProgramAndSolution(
		programId = '',
		programName = '',
		entities,
		userId,
		solutionId,
		isATargetedSolution = '',
		userDetails,
		isExternalProgram
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = {}
				let programAndSolutionData = {
					type: CONSTANTS.common.IMPROVEMENT_PROJECT,
					subType: CONSTANTS.common.IMPROVEMENT_PROJECT,
					isReusable: false,
					solutionId: solutionId,
					entities: entities,
				}

				if (programName !== '') {
					programAndSolutionData['programName'] = programName
				}

				if (programId !== '') {
					programAndSolutionData['programId'] = programId
				}
				let solutionAndProgramCreation = await solutionsHelper.createProgramAndSolution(
					userId,
					programAndSolutionData,
					isATargetedSolution,
					userDetails,
					isExternalProgram
				)
				if (!solutionAndProgramCreation.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.SOLUTION_PROGRAMS_NOT_CREATED,
					}
				}

				result.solutionInformation = _.pick(solutionAndProgramCreation.result.solution, [
					'name',
					'externalId',
					'description',
					'_id',
					'entityType',
					'certificateTemplateId',
				])

				result.solutionInformation._id = ObjectId(result.solutionInformation._id)

				result['solutionId'] = ObjectId(result.solutionInformation._id)
				result['solutionExternalId'] = result.solutionInformation.externalId

				result.programInformation = _.pick(solutionAndProgramCreation.result.program, [
					'_id',
					'name',
					'externalId',
					'description',
					'isAPrivateProgram',
				])

				result['programId'] = ObjectId(result.programInformation._id)
				result['programExternalId'] = result.programInformation.externalId
				result['isAPrivateProgram'] = result.programInformation.isAPrivateProgram

				result.programInformation._id = ObjectId(result.programInformation._id)

				if (solutionAndProgramCreation.result.parentSolutionInformation) {
					result['link'] = solutionAndProgramCreation.result.parentSolutionInformation.link
						? solutionAndProgramCreation.result.parentSolutionInformation.link
						: ''
				}

				return resolve({
					success: true,
					data: result,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Program and solution information
	 * @method
	 * @name createProgramAndMultipleSolutions
	 * @param {Object} programData - program data
	 * @param {Array} solutionData - solutions data
	 * @param {String} userId - user id
	 * @param {Boolean} isAPrivateProgram - isAPrivateProgram
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Created program and solution data.
	 */

	static createProgramAndMultipleSolutions(
		programData,
		solutionData,
		userId,
		isAPrivateProgram = false,
		userDetails
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let startDate = new Date()
				let endDate = new Date()
				endDate.setFullYear(endDate.getFullYear() + 1)
				let userPrivateProgram

				// Fetch programs data
				if (programData._id && programData._id != '') {
					userPrivateProgram = await programQueries.programsDocument(
						{
							_id: programData._id,
							tenantId: userDetails.userInformation.tenantId,
						},
						'all'
					)
					userPrivateProgram = userPrivateProgram[0]
				} else {
					// Create a program if program id is not passed
					let program = await solutionsHelper._createProgramData(
						programData.name,
						programData.externalId ? programData.externalId : programData.name + '-' + UTILS.epochTime(),
						isAPrivateProgram,
						CONSTANTS.common.ACTIVE_STATUS,
						programData.description ? programData.description : programData.name,
						userId,
						programData.startDate ? programData.startDate : startDate,
						programData.endDate ? programData.endDate : endDate,
						userId,
						programData.language ? programData.language : [],
						programData.source ? programData.source : {},
						userDetails
					)
					userPrivateProgram = await programQueries.createProgram(program)
				}
				let solutionsCreated = []
				for (const item of solutionData) {
					// Create a solution if solutions
					let solution = await solutionsHelper._createSolutionData(
						item.name ? item.name : programData.name,
						item.externalId ? item.externalId : programData.name + '-' + UTILS.epochTime(),
						isAPrivateProgram,
						CONSTANTS.common.ACTIVE_STATUS,
						item.description != '' ? item.description : programData.name,
						userId,
						false,
						'',
						CONSTANTS.common.IMPROVEMENT_PROJECT,
						'',
						userId,
						'',
						item.startDate ? item.startDate : startDate,
						item.endDate ? item.endDate : endDate,
						userDetails
					)
					solution = await solutionsQueries.createSolution(solution)
					solutionsCreated.push(solution)
				}

				let componentLength = userPrivateProgram.components.length || 0
				const componentArray = solutionsCreated.map((solution) => {
					return { _id: new ObjectId(solution._id), order: ++componentLength }
				})

				// Update the program components
				const updateProgram = await programsQueries.findAndUpdate(
					{
						_id: userPrivateProgram._id,
						tenantId: userDetails.userInformation.tenantId,
					},
					{
						$addToSet: { components: componentArray },
					}
				)
				const solutionsAndProgramData = {}
				solutionsAndProgramData['program'] = userPrivateProgram
				solutionsAndProgramData['solutions'] = solutionsCreated

				return resolve({
					success: true,
					data: solutionsAndProgramData,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Project details.
	 * @method
	 * @name details
	 * @param {String} projectId - project id.
	 * @param {String} userId - user id
	 * @param {Object} userRoleInformation - user role information
	 * @param {String} language - selected language
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} projects fetched from DB
	 */

	static details(projectId, userId, userRoleInformation = {}, language, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				// create query based on submission level
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				let queryObject = {
					_id: projectId,
					tenantId: tenantId,
				}
				if (process.env.SUBMISSION_LEVEL == 'USER') {
					queryObject['userId'] = userId
				}
				const projectDetails = await projectQueries.projectDocument(queryObject, 'all', [
					'taskReport',
					'projectTemplateId',
					'projectTemplateExternalId',
					'userId',
					'createdBy',
					'updatedBy',
					'createdAt',
					'updatedAt',
					'userRoleInformation',
					'__v',
				])
				if (!projectDetails.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
					}
				}
				// get translation data and modify actual data
				if (language !== '' && projectDetails[0].translations && projectDetails[0].translations[language]) {
					projectDetails[0] = UTILS.getTranslatedData(
						projectDetails[0],
						projectDetails[0].translations[language]
					)
				}
				//Once modified remove translations from response
				projectDetails[0] = _.omit(projectDetails[0], 'translations')
				if (Object.keys(userRoleInformation).length > 0) {
					if (
						!projectDetails[0].userRoleInformation ||
						!Object.keys(projectDetails[0].userRoleInformation).length > 0
					) {
						await projectQueries.findOneAndUpdate(
							{
								_id: projectId,
								tenantId: tenantId,
							},
							{
								$set: { userRoleInformation: userRoleInformation },
							}
						)
					}
				}

				let downloadableUrlsCall

				if (projectDetails[0].story?.pdfInformation.length > 0) {
					const pdfData = projectDetails[0].story.pdfInformation

					// Extract file paths from pdfInformation
					const filePaths = pdfData.map((item) => item.filePath)

					downloadableUrlsCall = await cloudServicesHelper.getDownloadableUrl(filePaths)
					const downloadableUrlArr = downloadableUrlsCall.result

					// Create a map for faster lookups
					const urlMap = new Map(downloadableUrlArr.map((item) => [item.filePath, item.url]))

					// Create download URLs
					const downloadUrls = filePaths.map(
						(filePath) =>
							`${process.env.ELEVATE_PROJECT_SERVICE_URL}/${process.env.SERVICE_NAME}${CONSTANTS.endpoints.AUTO_DOWNLOAD}?file=${filePath}`
					)

					projectDetails[0].story.pdfInformation.forEach((element) => {
						const targetUrl = urlMap.get(element.filePath)

						if (targetUrl) {
							element.url = targetUrl
							element.sharableUrl = `${process.env.ELEVATE_PROJECT_SERVICE_URL}/${process.env.SERVICE_NAME}${CONSTANTS.endpoints.AUTO_DOWNLOAD}?file=${element.filePath}`
							delete element.filePath
						}
					})
				}

				let result = await _projectInformation(projectDetails[0], language)
				if (!result.success) {
					return resolve(result)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_DETAILS_FETCHED,
					data: result.data,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: [],
				})
			}
		})
	}

	/**
	 * List of library projects.
	 * @method
	 * @name projects
	 * @param pageSize - Size of page.
	 * @param pageNo - Recent page no.
	 * @param search - search text.
	 * @param fieldsArray - array of projections fields.
	 * @param groupBy - groupBy query.
	 * @returns {Object} List of library projects.
	 */

	static projects(query, pageSize, pageNo, searchQuery, fieldsArray, groupBy = '') {
		return new Promise(async (resolve, reject) => {
			try {
				let matchQuery = {
					$match: query,
				}
				if (searchQuery && searchQuery.length > 0) {
					matchQuery['$match']['$or'] = searchQuery
				}

				let projection = {}
				fieldsArray.forEach((field) => {
					projection[field] = 1
				})

				let aggregateData = []
				aggregateData.push(matchQuery)
				aggregateData.push({
					$sort: { syncedAt: -1 },
				})

				if (groupBy !== '') {
					aggregateData.push({
						$group: groupBy,
					})
				} else {
					aggregateData.push({
						$project: projection,
					})
				}

				aggregateData.push(
					{
						$facet: {
							totalCount: [{ $count: 'count' }],
							data: [{ $skip: pageSize * (pageNo - 1) }, { $limit: pageSize }],
						},
					},
					{
						$project: {
							data: 1,
							count: {
								$arrayElemAt: ['$totalCount.count', 0],
							},
						},
					}
				)

				let result = await projectQueries.getAggregate(aggregateData)

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					data: {
						data: result[0].data,
						count: result[0].count ? result[0].count : 0,
					},
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {
						data: [],
						count: 0,
					},
				})
			}
		})
	}

	/**
	 * Get tasks from a user project.
	 * @method
	 * @name tasks
	 * @param {String} projectId - Project id.
	 * @param {Array} taskIds - Array of tasks ids.
	 * @param {String} tenantId - loggedin user's info
	 * @param {String} orgId - loggedin user's info
	 * @returns {Object} - return tasks from a project.
	 */

	static tasks(projectId, taskIds, tenantId, orgId) {
		return new Promise(async (resolve, reject) => {
			try {
				let aggregatedData = [
					{
						$match: {
							_id: ObjectId(projectId),
							tenantId: tenantId,
						},
					},
				]

				if (taskIds.length > 0) {
					let unwindData = {
						$unwind: '$tasks',
					}

					let matchData = {
						$match: {
							'tasks._id': { $in: taskIds },
						},
					}

					let groupData = {
						$group: {
							_id: '$_id',
							tasks: { $push: '$tasks' },
						},
					}

					aggregatedData.push(unwindData, matchData, groupData)
				}

				let projectData = {
					$project: { tasks: 1 },
				}

				aggregatedData.push(projectData)

				let projects = await projectQueries.getAggregate(aggregatedData)

				return resolve({
					success: true,
					data: projects,
				})
			} catch (error) {
				return resolve({
					success: false,
					data: [],
				})
			}
		})
	}

	/**
	 * Status of tasks.
	 * @method
	 * @name tasksStatus
	 * @param {String} projectId - Project id.
	 * @param {Array} taskIds - Tasks ids.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object}
	 */

	static tasksStatus(projectId, taskIds = [], userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				let tasks = await this.tasks(projectId, taskIds, tenantId, orgId)

				if (!tasks.success || !tasks.data.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
					}
				}

				let projectTasks = tasks.data[0].tasks
				let result = []

				for (let task = 0; task < projectTasks.length; task++) {
					let currentTask = projectTasks[task]

					let data = {
						type: currentTask.type,
						status: currentTask.status,
						_id: currentTask._id,
					}

					if (
						[
							CONSTANTS.common.ASSESSMENT,
							CONSTANTS.common.OBSERVATION,
							CONSTANTS.common.SURVEY,
							CONSTANTS.common.IMPROVEMENT_PROJECT,
						].includes(currentTask.type)
					) {
						let completedSubmissionCount = 0

						let minNoOfSubmissionsRequired = currentTask.solutionDetails.minNoOfSubmissionsRequired
							? currentTask.solutionDetails.minNoOfSubmissionsRequired
							: CONSTANTS.common.DEFAULT_SUBMISSION_REQUIRED

						data['submissionStatus'] = CONSTANTS.common.STARTED

						let submissionDetails = {}
						//Getting information of dynamic solutions like surveyInformation observationInformation
						let dynamicTaskInfromation = `${currentTask.type}Information`
						if (currentTask[dynamicTaskInfromation]) {
							submissionDetails = currentTask[dynamicTaskInfromation]
						} else if (currentTask.submissionDetails) {
							submissionDetails = currentTask.submissionDetails
						}

						data['submissionDetails'] = submissionDetails

						if (currentTask.submissions && currentTask.submissions.length > 0) {
							let completedSubmissionDoc
							completedSubmissionCount = currentTask.submissions.filter(
								(eachSubmission) => eachSubmission.status === CONSTANTS.common.COMPLETED_STATUS
							).length

							if (completedSubmissionCount >= minNoOfSubmissionsRequired) {
								completedSubmissionDoc = currentTask.submissions.find(
									(eachSubmission) => eachSubmission.status === CONSTANTS.common.COMPLETED_STATUS
								)
								data.submissionStatus = CONSTANTS.common.COMPLETED_STATUS
							} else {
								completedSubmissionDoc = currentTask.submissions.find(
									(eachSubmission) => eachSubmission.status === CONSTANTS.common.STARTED
								)
							}

							Object.assign(data['submissionDetails'], completedSubmissionDoc)
						} else {
							data['submissionDetails'].status = CONSTANTS.common.STARTED
						}
					}

					result.push(data)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.TASKS_STATUS_FETCHED,
					data: result,
				})
			} catch (error) {
				return reject({
					success: false,
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					data: [],
				})
			}
		})
	}

	/**
	 * Update task.
	 * @method
	 * @name updateTask
	 * @param {String} projectId - Project id.
	 * @param {String} taskId - Task id.
	 * @param {Object} updatedData - Update data.
	 * @returns {Object}
	 */

	static pushSubmissionToTask(projectId, taskId, updatedData) {
		return new Promise(async (resolve, reject) => {
			try {
				let updateSubmission = []

				let isAProjectPlan = false
				let currentTask = null
				let projectDocument = await projectQueries.projectDocument(
					{
						_id: projectId,
						'tasks._id': taskId,
					},
					['tasks']
				)

				if (!projectDocument.length > 0) {
					projectDocument = await projectQueries.projectDocument(
						{
							_id: projectId,
							'tasks.children._id': taskId,
						},
						['tasks']
					)
					if (!projectDocument.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
						}
					}
					isAProjectPlan = true
				}

				if (isAProjectPlan) {
					currentTask = projectDocument[0].tasks
						.flatMap((task) => task.children || [])
						.find((childTask) => childTask._id == taskId)
				} else {
					currentTask = projectDocument[0].tasks.find((task) => task._id == taskId)
				}

				let submissions =
					currentTask.submissions && currentTask.submissions.length > 0 ? currentTask.submissions : []

				// if submission array is empty
				if (!submissions && !submissions.length > 0) {
					updateSubmission.push(updatedData)
				}

				// submission not exist
				let checkSubmissionExist = submissions.findIndex((submission) => submission._id == updatedData._id)

				if (checkSubmissionExist == -1) {
					updateSubmission = submissions
					updateSubmission.push(updatedData)
				} else {
					//submission exist
					submissions[checkSubmissionExist] = updatedData
					updateSubmission = submissions
				}

				let tasksUpdated
				if (!isAProjectPlan) {
					let updateFields = {
						'tasks.$.submissions': updateSubmission,
						'tasks.$.updatedAt': new Date(),
					}
					if (process.env.PUSH_SUBMISION_STATUS_TO_TASK === 'true') {
						updateFields['tasks.$.status'] = updatedData.status
					}
					tasksUpdated = await projectQueries.findOneAndUpdate(
						{
							_id: projectId,
							'tasks._id': taskId,
						},
						{
							$set: updateFields,
						}
					)
				} else {
					const updateFields = {
						'tasks.$[task].children.$[child].submissions': updateSubmission,
						'tasks.$[task].children.$[child].updatedAt': new Date(),
					}

					if (process.env.PUSH_SUBMISION_STATUS_TO_TASK === 'true') {
						updateFields['tasks.$[task].children.$[child].status'] = updatedData.status
					}

					tasksUpdated = await projectQueries.findOneAndUpdate(
						{
							_id: projectId,
						},
						{
							$set: updateFields,
						},
						{
							arrayFilters: [{ 'task.children._id': taskId }, { 'child._id': taskId }],
						}
					)
					// const parentTask = projectDocument[0].tasks.find((task) =>
					// 	task.children?.some((childTask) => String(childTask._id) === String(taskId))
					// );
					// if (parentTask && process.env.PUSH_SUBMISION_STATUS_TO_TASK === 'true') {
					// 	await checkAndCompleteParentTask(projectId, parentTask._id);
					// }
				}

				if (process.env.PUSH_SUBMISION_STATUS_TO_TASK === 'true') {
					const completeProject = await checkAndCompleteProject(projectId)

					if (process.env.ENABLE_PROGRAM_USER_MAPPING === 'true') {
						await this.updateProgramUserMapping(projectId)
					}
				}

				if (!tasksUpdated._id) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_UPDATED,
					}
				}
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.USER_PROJECT_UPDATED,
					result: tasksUpdated._id,
				})
			} catch (error) {
				return reject(error)
			}
		})
	}

	static updateProgramUserMapping(projectId) {
		return new Promise(async (resolve, reject) => {
			try {
				let resp
				const progressStats = await getTaskCompletionStats(projectId)

				const projects = await projectQueries.projectDocument({ _id: projectId }, [
					'userId',
					'programId',
					'programExternalId',
					'referenceFrom',
					'createdBy',
					'entityId',
					'tenantId',
				])
				if (!projects.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
					}
				}
				const project = projects[0]

				// if (project?.metaInformation?.programUserMappingRef) {
				// 	const programUserMappingRef = project.metaInformation.programUserMappingRef;
				// if project is  created by the user, then update the entity in the program user mapping
				let userId = project.createdBy
				resp = await programUsersService.programUsersDocument(
					{ userId: project.createdBy, programId: project.programId },
					['_id', 'entities']
				)
				if (resp.length > 0) {
					//if (project.userId != project.createdBy) {
					const entity = resp[0].entities.find((entity) => entity.entityId === project.entityId)
					if (entity) {
						//entity.status = (project.status === CONSTANTS.common.COMPLETED_STATUS) ? "ONBOARDED" : "IN_PROGRESS";
						if (entity.status === 'IN_PROGRESS' && entity.idpProjectId == project._id) {
							statusUpdate = {
								idpProgress: progressStats,
								status: 'IN_PROGRESS',
							}
							if (progressStats.projectStatus === 'completed') {
								statusUpdate.status = 'COMPLETED'
							}

							await programUsersService.updateEntity(
								resp[0]._id,
								'',
								'',
								'',
								project.entityId,
								statusUpdate
							)

							if (project.userId != project.createdBy) {
								//userId = project.createdBy;
								//updateSpecificEntity = true;

								const resp1 = await programUsersService.createOrUpdate(
									{ userId: project.userId, programId: project.programId },
									{ metaInformation: { idpProgress: progressStats }, status: statusUpdate.status }
								)
							}
						}
						if (
							entity.status === 'NOT_ONBOARDED' &&
							entity.onBoardedProjectId.toString() === project._id.toString()
						) {
							await programUsersService.updateEntity(
								project.createdBy,
								project.programId,
								'',
								project.entityId,
								{
									onBoardingProgress: progressStats,
								},
								project.tenantId
							)
						}
					}
					return resolve({
						success: true,
						message: 'Program user mapping handled successfully',
					})
				}
			} catch (error) {
				return resolve({
					success: true,
					message: 'Program user mapping handled successfully',
				})
			}
		})
	}
	/**
	 * Solutions details
	 * @method
	 * @name solutionDetails
	 * @param {String} projectId - Project id.
	 * @param {Array} taskId - Tasks id.
	 * @param {Object} bodyData - Req body data
	 * @param {String} userToken - Logged in user token.
	 * @param {String} userId - userId
	 * @param {Object} userDetails - logged in userDetails to get tenantAndOrgId
	 * @returns {Object}
	 */

	static solutionDetails(projectId, taskId, bodyData = {}, userToken, userId, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let isAProjectPlan = false
				let project = await projectQueries.projectDocument(
					{
						_id: projectId,
						'tasks._id': taskId,
					},
					[
						'entityInformation._id',
						'entityInformation.entityType',
						'tasks.type',
						'tasks._id',
						'tasks.solutionDetails',
						'tasks.projectTemplateDetails',
						'tasks.submissions',
						'tasks.observationInformation',
						'tasks.surveyInformation',
						'tasks.improvementProjectInformation',
						'tasks.externalId',
						'programInformation._id',
						'projectTemplateId',
					]
				)
				if (!project.length > 0) {
					project = await projectQueries.projectDocument(
						{
							_id: projectId,
							'tasks.children._id': taskId,
						},
						[
							'entityInformation._id',
							'entityInformation.entityType',
							'tasks.type',
							'tasks._id',
							'tasks.solutionDetails',
							'tasks.projectTemplateDetails',
							'tasks.submissions',
							'tasks.observationInformation',
							'tasks.surveyInformation',
							'tasks.improvementProjectInformation',
							'tasks.externalId',
							'programInformation._id',
							'projectTemplateId',
							'tasks.children',
						]
					)
					if (!project.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
						}
					}
					isAProjectPlan = true
				}
				let currentTask
				if (isAProjectPlan) {
					currentTask = project[0].tasks
						.flatMap((task) => task.children || [])
						.find((childTask) => childTask._id == taskId)
				} else {
					currentTask = project[0].tasks.find((task) => task._id == taskId)
				}
				if (!currentTask) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: 'Task not found',
					}
				}
				let solutionDetails = currentTask.solutionDetails
				let assessmentOrObservationData = {}

				if (
					// project[0].entityInformation &&
					// project[0].entityInformation.entityType &&
					project[0].programInformation &&
					project[0].programInformation._id
				) {
					assessmentOrObservationData = {
						// entityType: project[0].entityInformation.entityType,
						programId: project[0].programInformation._id,
					}
					if (project[0]?.entityInformation && project[0]?.entityInformation?.entityType) {
						assessmentOrObservationData['entityType'] = project[0].entityInformation.entityType
						assessmentOrObservationData['entityId'] = project[0].entityInformation._id
					}
					//get task solutionType from solutionDetails if solutionDetails not exist from projectTemplateDetails
					let taskSolutionType = solutionDetails?.type ?? currentTask.projectTemplateDetails.type
					let dynamicTaskInfromation = `${taskSolutionType}Information`
					if (currentTask[dynamicTaskInfromation]) {
						assessmentOrObservationData = currentTask[dynamicTaskInfromation]
					} else {
						let assessmentOrObservation = {
							token: userToken,
							solutionDetails: solutionDetails,
							entityType: assessmentOrObservationData.entityType,
							programId: assessmentOrObservationData.programId,
							project: {
								_id: projectId,
								taskId: taskId,
							},
							entityId: assessmentOrObservationData?.entityId,
						}

						// get solutions details based on solutionTypes
						/*
						******Sample response*************
		                       {
                                  "success": true,
								   data:{
                                     "programId": "685140cbf891ccf74e05baf9",
                                     "observationId": "685146542054fe175c7150c8",
                                    "solutionId": "685140d1ffc25f705c56e99e",
					               }
                               }

						*/
						const getSolutionDetails = {
							[CONSTANTS.common.ASSESSMENT]: () => _assessmentDetails(assessmentOrObservation),
							[CONSTANTS.common.OBSERVATION]: () =>
								_observationDetails(assessmentOrObservation, bodyData),
							[CONSTANTS.common.IMPROVEMENT_PROJECT]: async () => {
								// get programTempalteDetails aliong with solutionDetils if task type is improvementProject
								assessmentOrObservation.projectTemplateDetails = currentTask.projectTemplateDetails
								return await this.improvementProjectDetails(
									assessmentOrObservation,
									bodyData,
									userToken,
									userId,
									userDetails
								)
							},
							[CONSTANTS.common.SURVEY]: () => _surveyDetails(assessmentOrObservation, bodyData),
						}
						let fetchSolutions = getSolutionDetails[taskSolutionType]

						if (!fetchSolutions) {
							throw {
								status: HTTP_STATUS_CODE.bad_request.status,
								message: CONSTANTS.apiResponses.SOLUTION_TYPE_INVALID,
							}
						}

						let assignedAssessmentOrObservation = await fetchSolutions()
						if (!assignedAssessmentOrObservation.success) {
							return resolve(assignedAssessmentOrObservation)
						}

						assessmentOrObservationData = _.merge(
							assessmentOrObservationData,
							assignedAssessmentOrObservation.data
						)

						if (!currentTask?.solutionDetails?.isReusable) {
							assessmentOrObservationData['programId'] = project[0].programInformation._id
						}

						if (!isAProjectPlan) {
							let fieldToUpdate = `tasks.$.${taskSolutionType}Information`

							await projectQueries.findOneAndUpdate(
								{
									_id: projectId,
									'tasks._id': taskId,
								},
								{
									$set: {
										[fieldToUpdate]: assessmentOrObservationData,
									},
								}
							)
						} else {
							let fieldToUpdate = `tasks.$[task].children.$[child].${taskSolutionType}Information`

							await projectQueries.findOneAndUpdate(
								{
									_id: projectId,
								},
								{
									$set: {
										[fieldToUpdate]: assessmentOrObservationData,
									},
								},
								{
									arrayFilters: [
										{ 'task.children._id': taskId }, // Filter parent task
										{ 'child._id': taskId }, // Filter child task
									],
								}
							)
						}
					}

					// assessmentOrObservationData['entityType'] = project[0].entityInformation.entityType
				}

				if (currentTask.solutionDetails && !_.isEmpty(currentTask.solutionDetails)) {
					assessmentOrObservationData.solutionDetails = currentTask.solutionDetails
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.SOLUTION_DETAILS_FETCHED,
					data: assessmentOrObservationData,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * fetch registry in entities.
	 * @method
	 * @name listByLocationIds
	 * @param {Object} locationIds - locationIds
	 * @returns {Object} entity Document
	 */

	static listByLocationIds(locationIds) {
		return new Promise(async (resolve, reject) => {
			try {
				let filterQuery = {
					$or: [
						{
							'registryDetails.code': { $in: locationIds },
						},
						{
							'registryDetails.locationId': { $in: locationIds },
						},
					],
				}

				let entities = await entitiesService.entityDocuments(filterQuery, [
					'metaInformation',
					'entityType',
					'entityTypeId',
					'registryDetails',
				])

				if (!entities.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.ENTITIES_FETCHED,
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.ENTITY_FETCHED,
					data: entities,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
				})
			}
		})
	}

	/**
	 * Creation of user targeted projects.
	 * @method
	 * @name detailsV2
	 * @param {String} projectId - project id.
	 * @param {String} solutionId - solution id.
	 * @param {String} userId - logged in user id.
	 * @param {String} userToken - logged in user token.
	 * @param {Object} bodyData - Requested body data.
	 * @param {String} [appName = ""] - App name.
	 * @param {String} [appVersion = ""] - App version.
	 * @param {String} [Language = ""] - LanguageCode.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Project details.
	 */

	static detailsV2(
		projectId,
		solutionId = '',
		userId,
		userToken,
		bodyData,
		appName = '',
		appVersion = '',
		templateId = '',
		language = '',
		userDetails
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionExternalId = ''
				let templateDocuments
				let defaultACL = _.cloneDeep(CONSTANTS.common.DEFAULT_ACL)
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId

				if (templateId !== '') {
					templateDocuments = await projectTemplateQueries.templateDocument({
						externalId: templateId,
						isReusable: false,
						tenantId: tenantId,
					})
					if (!templateDocuments.length > 0) {
						throw {
							message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}

					solutionId = templateDocuments[0].solutionId ? templateDocuments[0].solutionId : solutionId
					solutionExternalId = templateDocuments[0].solutionExternalId
				}
				let userRoleInformation = _.omit(bodyData, [
					'referenceFrom',
					'submissions',
					'hasAcceptedTAndC',
					'link',
					'entityId',
					'acl',
				])
				if (projectId === '') {
					// This will check wether the user user is targeted to solution or not based on his userRoleInformation
					const targetedSolutionId = await solutionsHelper.isTargetedBasedOnUserProfile(
						solutionId,
						userRoleInformation,
						userDetails
					)
					if (!targetedSolutionId.success) {
						throw {
							success: false,
							message: targetedSolutionId.message,
						}
					}
					//based on above api will check for projects wether its is private project or public project
					const projectDetails = await projectQueries.projectDocument(
						{
							solutionId: solutionId,
							userId: userId,
							isAPrivateProgram: targetedSolutionId.result.isATargetedSolution ? false : true,
							tenantId: tenantId,
							entityId: bodyData.entityId ? bodyData.entityId : '',
						},
						['_id']
					)
					if (projectDetails.length > 0) {
						projectId = projectDetails[0]._id
					} else {
						let isAPrivateSolution = targetedSolutionId.result.isATargetedSolution === false ? true : false
						let solutionDetails = {}

						if (templateId === '') {
							// If solution Id of a private program is passed, fetch solution details
							if (isAPrivateSolution && solutionId != '') {
								solutionDetails = await solutionsQueries.solutionsDocument(
									{
										_id: solutionId,
										isAPrivateProgram: true,
										tenantId: tenantId,
									},
									[
										'name',
										'externalId',
										'description',
										'programId',
										'programName',
										'programDescription',
										'programExternalId',
										'isAPrivateProgram',
										'projectTemplateId',
										'entityType',
										'entityTypeId',
										'language',
										'creator',
									]
								)
								if (!solutionDetails.length > 0) {
									throw {
										status: HTTP_STATUS_CODE.bad_request.status,
										message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
									}
								}
								solutionDetails = solutionDetails[0]
							} else {
								solutionDetails = await solutionsHelper.detailsBasedOnRoleAndLocation(
									solutionId,
									_.omit(bodyData, ['entityId', 'acl']),
									'',
									isAPrivateSolution
								)

								// await coreService.solutionDetailsBasedOnRoleAndLocation(
								//     userToken,
								//     bodyData,
								//     solutionId,
								//     isAPrivateSolution
								// );

								// if (
								// 	!solutionDetails.success ||
								// 	(solutionDetails.data.data && !solutionDetails.data.data.length > 0)
								// ) {
								// 	throw {
								// 		status: HTTP_STATUS_CODE.bad_request.status,
								// 		message: CONSTANTS.apiResponses.SOLUTION_DOES_NOT_EXISTS_IN_SCOPE,
								// 	}
								// }
								if (
									solutionDetails &&
									solutionDetails.success &&
									solutionDetails.data.data &&
									solutionDetails.data.data.length > 0
								) {
									solutionDetails = solutionDetails.data
								}
							}
						} else {
							solutionDetails = await solutionsQueries.solutionsDocument({
								_id: solutionId,
								tenantId: tenantId,
							})
							solutionDetails = solutionDetails[0]
							// if( !solutionDetails.success ) {
							//     throw {
							//         message : CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
							//         status : HTTP_STATUS_CODE.bad_request.status
							//     }
							// }

							// solutionDetails = solutionDetails.data[0];
						}

						// program join is not implemented in this for drop 1

						// check for requestForPIIConsent data
						// let queryData = {}
						// queryData['_id'] = solutionDetails.programId
						// let programDetails = await programsQueries.programsDocument(queryData, ['requestForPIIConsent'])

						// // if requestForPIIConsent not there do not call program join
						// if (
						// 	Object.keys(solutionDetails).length > 0 &&
						// 	programDetails.length > 0 &&
						// 	programDetails[0].hasOwnProperty('requestForPIIConsent')
						// ) {
						// 	// program join API call it will increment the noOfResourcesStarted counter and will make user join program
						// 	// before creating any project this api has to called
						// 	let programUsers = await programUsersQueries.programUsersDocument(
						// 		{
						// 			userId: userId,
						// 			programId: solutionDetails.programId,
						// 		},
						// 		['_id', 'resourcesStarted']
						// 	)

						// 	if (
						// 		!programUsers.length > 0 ||
						// 		(programUsers.length > 0 && programUsers[0].resourcesStarted == false)
						// 	) {
						// 		let programJoinBody = {}
						// 		programJoinBody.userRoleInformation = userRoleInformation
						// 		programJoinBody.isResource = true
						// 		programJoinBody.consentShared = true
						// 		let joinProgramData = await programsHelper.join(
						// 			solutionDetails.programId,
						// 			programJoinBody,
						// 			userId
						// 		)
						// 		if (!joinProgramData.success) {
						// 			return resolve({
						// 				status: HTTP_STATUS_CODE.bad_request.status,
						// 				message: CONSTANTS.apiResponses.PROGRAM_JOIN_FAILED,
						// 			})
						// 		}
						// 	}
						// }
						let projectTemplateId
						if (templateId != '' && templateDocuments && templateDocuments.length > 0) {
							projectTemplateId = templateDocuments[0]._id
						} else {
							projectTemplateId = solutionDetails.projectTemplateId
						}

						let projectCreation = await this.userAssignedProjectCreation(
							projectTemplateId,
							userId,
							tenantId,
							orgId,
							userDetails,
							solutionDetails.programId
						)
						if (!projectCreation.success) {
							return resolve(projectCreation)
						}
						projectCreation.data['isAPrivateProgram'] = solutionDetails.isAPrivateProgram
						if (Object.keys(solutionDetails).length > 0) {
							const programOrgId = await programsQueries.programsDocument(
								{
									_id: ObjectId(solutionDetails.programId),
								},
								['orgId']
							)
							projectCreation.data.programInformation = {
								_id: ObjectId(solutionDetails.programId),
								externalId: solutionDetails.programExternalId,
								description: solutionDetails.programDescription
									? solutionDetails.programDescription
									: '',
								name: solutionDetails.programName,
								orgId: programOrgId ? programOrgId[0].orgId : '',
							}

							projectCreation.data.solutionInformation = {
								_id: ObjectId(solutionDetails._id),
								externalId: solutionDetails.externalId,
								description: solutionDetails.description ? solutionDetails.description : '',
								name: solutionDetails.name,
								submissionLevel: solutionDetails.submissionLevel
									? solutionDetails.submissionLevel
									: process.env.SUBMISSION_LEVEL,
								scope: solutionDetails.scope,
								// referenceFrom: solutionDetails.referenceFrom ? solutionDetails.referenceFrom : '', // added for project as a task
								// project: solutionDetails.project ? solutionDetails.project : '',
								entityType: solutionDetails.entityType,
								parentEntityKey: solutionDetails.parentEntityKey,
							}

							projectCreation.data['programId'] = projectCreation.data.programInformation._id

							projectCreation.data['programExternalId'] =
								projectCreation.data.programInformation.externalId

							projectCreation.data['solutionId'] = projectCreation.data.solutionInformation._id

							projectCreation.data['solutionExternalId'] =
								projectCreation.data.solutionInformation.externalId

							// If req.body contains acl add it, else add defaultACL
							if (bodyData.hasOwnProperty('acl')) {
								bodyData.acl.visibility = bodyData.acl.visibility.toUpperCase()
								bodyData.acl.users.push(userId)
								if (!bodyData.acl.hasOwnProperty('scope') || !(bodyData.acl.scope.length > 0)) {
									bodyData.acl['scope'] = solutionDetails.scope
								}
								projectCreation.data['acl'] = bodyData.acl
							} else {
								defaultACL.users.push(userId)
								defaultACL.scope = solutionDetails.scope
								projectCreation.data['acl'] = defaultACL
							}
							projectCreation.data['updateHistory'] = [
								{
									userId: userId,
									timeStamp: new Date(),
								},
							]
						}

						projectCreation.data['userRole'] = bodyData.role

						projectCreation.data['appInformation'] = {}

						if (appName !== '') {
							projectCreation.data['appInformation']['appName'] = appName
						}

						if (appVersion !== '') {
							projectCreation.data['appInformation']['appVersion'] = appVersion
						}

						if (solutionDetails.certificateTemplateId && solutionDetails.certificateTemplateId !== '') {
							// <- Add certificate template details to projectCreation data if present ->
							const certificateTemplateDetails =
								await certificateTemplateQueries.certificateTemplateDocument({
									_id: solutionDetails.certificateTemplateId,
									tenantId: tenantId,
								})

							// create certificate object and add data if certificate template is present.
							if (certificateTemplateDetails.length > 0) {
								projectCreation.data['certificate'] = _.pick(certificateTemplateDetails[0], [
									'templateUrl',
									'status',
									'criteria',
								])
								projectCreation.data['certificate']['templateId'] =
									solutionDetails.certificateTemplateId
							}
						}

						// remove certificate object if project is of type private
						if (projectCreation.data.isAPrivateProgram) {
							delete projectCreation.data.certificate
							delete projectCreation.data.certificateTemplateId
						}

						let getUserProfileFromObservation = false

						if (bodyData && Object.keys(bodyData).length > 0) {
							if (bodyData.hasAcceptedTAndC) {
								projectCreation.data.hasAcceptedTAndC = bodyData.hasAcceptedTAndC
							}

							if (bodyData.link) {
								projectCreation.data.link = bodyData.link
							}

							if (bodyData.referenceFrom) {
								projectCreation.data.referenceFrom = bodyData.referenceFrom

								if (bodyData.submissions) {
									if (
										bodyData.submissions.observationId &&
										bodyData.submissions.observationId != ''
									) {
										getUserProfileFromObservation = true
									}
									projectCreation.data.submissions = bodyData.submissions
								}
							}

							if (bodyData.role) {
								projectCreation.data['userRole'] = bodyData.role
							}
							// Adding entityInformation in Project
							if (solutionDetails.entityType && bodyData[solutionDetails.entityType]) {
								const res = await entitiesService.entityDocuments({
									_id: bodyData[solutionDetails.entityType],
									tenantId,
								})
								const entitiesList = Array.isArray(res) ? res : res?.data
								if (!Array.isArray(entitiesList) || entitiesList.length === 0) {
									throw {
										message: CONSTANTS.apiResponses.ENTITY_NOT_FOUND,
										status: HTTP_STATUS_CODE.bad_request.status,
									}
								}
								const entity = entitiesList[0]
								projectCreation.data.entityInformation = {
									_id: entity._id,
									entityType: entity.entityType,
									entityTypeId: entity.entityTypeId,
									entityId: entity._id,
									externalId: entity?.metaInformation?.externalId || '',
									entityName: entity?.metaInformation?.name || '',
								}
								projectCreation.data.entityId = entity._id
							}
						}

						projectCreation.data.status = CONSTANTS.common.STARTED
						projectCreation.data.lastDownloadedAt = new Date()

						// fetch userRoleInformation from observation if referenecFrom is observation
						// let addReportInfoToSolution = false;
						// if ( getUserProfileFromObservation ){

						//     let observationDetails = await entitiesHelper.details(
						//         userToken,
						//         bodyData.submissions.observationId
						//     );

						//     if( observationDetails.data &&
						//         Object.keys(observationDetails.data).length > 0 &&
						//         observationDetails.data.userRoleInformation &&
						//         Object.keys(observationDetails.data.userRoleInformation).length > 0
						//     ) {

						//         userRoleInformation = observationDetails.data.userRoleInformation;

						//     }

						//     if( observationDetails.data &&
						//         Object.keys(observationDetails.data).length > 0 &&
						//         observationDetails.data.userProfile &&
						//         Object.keys(observationDetails.data.userProfile).length > 0
						//     ) {

						//         projectCreation.data.userProfile = observationDetails.data.userProfile;
						//         addReportInfoToSolution = true;

						//     } else {
						//         //Fetch user profile information by calling sunbird's user read api.

						//         let userProfile = await projectService.profileRead(userToken)
						//         if ( userProfile.success &&
						//              userProfile.data &&
						//              userProfile.data.response
						//         ) {
						//                 projectCreation.data.userProfile = userProfile.data.response;
						//                 addReportInfoToSolution = true;
						//         }
						//     }

						// } else {
						//     //Fetch user profile information by calling sunbird's user read api.

						let userProfileData = await projectService.profileRead(userToken)
						// Check if the user profile fetch was successful
						if (!userProfileData.success) {
							throw {
								message: CONSTANTS.apiResponses.USER_DATA_FETCH_UNSUCCESSFUL,
								status: HTTP_STATUS_CODE.bad_request.status,
							}
						}
						if (userProfileData.success && userProfileData.data) {
							projectCreation.data.userProfile = userProfileData.data
							// addReportInfoToSolution = true;
						}
						// }

						projectCreation.data.userRoleInformation = userRoleInformation

						//compare & update userProfile with userRoleInformation
						if (
							projectCreation.data.userProfile &&
							userRoleInformation &&
							Object.keys(userRoleInformation).length > 0 &&
							Object.keys(projectCreation.data.userProfile).length > 0
						) {
							// let updatedUserProfile = await _updateUserProfileBasedOnUserRoleInfo(
							//     projectCreation.data.userProfile,
							//     userRoleInformation
							// );
							let updatedUserProfile = await projectService.profileRead(userToken)

							// Check if the user profile fetch was successful
							if (!updatedUserProfile.success) {
								throw {
									message: CONSTANTS.apiResponses.USER_DATA_FETCH_UNSUCCESSFUL,
									status: HTTP_STATUS_CODE.bad_request.status,
								}
							}
							if (
								updatedUserProfile &&
								updatedUserProfile.success &&
								Object.keys(updatedUserProfile.data).length > 0
							) {
								projectCreation.data.userProfile = updatedUserProfile.data
							}
						}

						if (bodyData.project) {
							projectCreation.data['project'] = bodyData.project
							projectCreation.data['referenceFrom'] = CONSTANTS.common.PROJECT
						}
						projectCreation.data['tenantId'] = tenantId
						projectCreation.data['orgId'] = orgId

						let project = await projectQueries.createProject(projectCreation.data)

						// if ( addReportInfoToSolution && project.solutionId ) {
						//     let updateSolution = await solutionsHelper.addReportInformationInSolution(
						//         project.solutionId,
						//         project.userProfile
						//     );
						// }
						let kafkaUserProject = {
							userId: userId,
							projects: project,
						}
						await this.attachEntityInformationIfExists(project)
						await kafkaProducersHelper.pushProjectToKafka(project)
						await kafkaProducersHelper.pushUserActivitiesToKafka(kafkaUserProject)
						// update submission data for project as task
						if (project.project && project.referenceFrom === CONSTANTS.common.PROJECT) {
							let updateTaskSubmissionData = {
								_id: project._id,
								status: project.status,
								completedDate: project.completedDate ? project.completedDate : '',
							}
							// For observation and survey we will be using kafka to update task submission status But for project as a task calling the function directly
							await this.pushSubmissionToTask(
								project.project._id,
								project.project.taskId,
								updateTaskSubmissionData
							)
						}
						projectId = project._id
					}
				}
				let projectDetails = await this.details(projectId, userId, userRoleInformation, language, userDetails)
				// let revertStatusorNot = UTILS.revertStatusorNot(appVersion);
				// if ( revertStatusorNot ) {
				//     projectDetails.data.status = UTILS.revertProjectStatus(projectDetails.data.status);
				// } else {
				//     projectDetails.data.status = UTILS.convertProjectStatus(projectDetails.data.status);
				// }
				// make templateUrl downloadable befor passing to front-end
				if (
					projectDetails.data.certificate &&
					projectDetails.data.certificate.pdfPath &&
					projectDetails.data.certificate.pdfPath !== '' &&
					projectDetails.data.certificate.svgPath &&
					projectDetails.data.certificate.svgPath !== ''
				) {
					let certificateTemplateDownloadableUrl = await cloudServicesHelper.getDownloadableUrl([
						projectDetails.data.certificate.pdfPath,
						projectDetails.data.certificate.svgPath,
					])
					if (
						certificateTemplateDownloadableUrl &&
						certificateTemplateDownloadableUrl.result &&
						certificateTemplateDownloadableUrl.result.length > 0
					) {
						projectDetails.data.certificate['pdfUrl'] = certificateTemplateDownloadableUrl.result[0].url
						projectDetails.data.certificate['svgUrl'] = certificateTemplateDownloadableUrl.result[1].url
					}
				}
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_DETAILS_FETCHED,
					data: projectDetails.data,
					result: projectDetails.data,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: [],
				})
			}
		})
	}

	/**
	 * Adds a story to a specific project by appending its attachments and other details.
	 * @method
	 * @name addStory
	 * @param {Object} storyData - The data of the story to be added, including its attachments.
	 * @param {String} projectId - The unique identifier of the project to which the story will be added.
	 * @param {Object} userDetails - loggedin user info
	 * @returns {Promise<Object>} - A promise resolving to a success or failure response.
	 */
	static addStory(storyData, projectId, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const userId = userDetails.userInformation.userId
				const tenantId = userDetails.userInformation.tenantId
				// Fetch project details from the database
				const projectDeatils = await projectQueries.projectDocument(
					{
						_id: ObjectId(projectId),
						status: CONSTANTS.common.SUBMITTED_STATUS,
						isDeleted: false,
						userId: userId,
						tenantId,
					},
					['all']
				)
				// Check if the project exists
				if (!projectDeatils.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				// Initialize the attachments array if it does not exist
				projectDeatils[0].attachments = projectDeatils[0].attachments || []

				// Append story attachments to the project's attachments array
				if (projectDeatils[0].attachments && storyData.story.attachments) {
					// Combine existing and new attachments, adding the "page" key to each
					projectDeatils[0].attachments = [
						...projectDeatils[0].attachments,
						...storyData.story.attachments,
					].map((attachment) => ({
						...attachment,
						page: 'story',
					}))
				}

				// Remove attachments from storyData
				delete storyData.story.attachments

				// Update the project in the database with the new attachments and story data
				const UpdatedProject = await projectQueries.findOneAndUpdate(
					{
						_id: ObjectId(projectId),
						tenantId,
					},
					{ $set: { attachments: projectDeatils[0].attachments, ...storyData } }
				)

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.STORY_ADDED_SUCCESSFULLY,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message,
				})
			}
		})
	}

	/**
	 * User assigned project creation data.
	 * @method
	 * @name userAssignedProjectCreation
	 * @param {String} templateId - Project template id.
	 * @param {String} userId - Logged in user id.
	 * @param {String} tenantId - loggedin user's tenant id.
	 * @param {String} orgId - loggedin user's org id
	 * @returns {String} - message.
	 */

	static userAssignedProjectCreation(templateId, userId, tenantId, orgId, userDetails = {}, programId = '') {
		return new Promise(async (resolve, reject) => {
			try {
				const projectTemplateData = await projectTemplateQueries.templateDocument(
					{
						status: CONSTANTS.common.PUBLISHED,
						_id: templateId,
						isReusable: false,
						tenantId: tenantId,
					},
					'all',
					['ratings', 'noOfRatings', 'averageRating']
				)

				if (!projectTemplateData.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				let result = { ...projectTemplateData[0] }

				result.projectTemplateId = result._id
				result.projectTemplateExternalId = result.externalId
				result.userId = userId
				result.createdBy = userId
				result.updatedBy = userId

				result.createdAt = new Date()
				result.updatedAt = new Date()

				result.assesmentOrObservationTask = false

				if (projectTemplateData[0].tasks && projectTemplateData[0].tasks.length > 0) {
					const tasksAndSubTasks = await projectTemplatesHelper.tasksAndSubTasks(
						projectTemplateData[0]._id,
						'',
						tenantId,
						orgId
					)
					if (tasksAndSubTasks.length > 0) {
						result.tasks = await _projectTask(tasksAndSubTasks, false, '', '', programId, userDetails)
						result.tasks.forEach((task) => {
							if (
								task &&
								task.type &&
								(task.type === CONSTANTS.common.ASSESSMENT ||
									task.type === CONSTANTS.common.OBSERVATION)
							) {
								result.assesmentOrObservationTask = true
							}
						})

						let taskReport = {
							total: result.tasks.length,
						}

						result.tasks.forEach((task) => {
							if (task && task.isDeleted == false) {
								if (!taskReport[task.status]) {
									taskReport[task.status] = 1
								} else {
									taskReport[task.status] += 1
								}
							} else {
								taskReport.total = taskReport.total - 1
							}
						})

						result['taskReport'] = taskReport
					}
				}

				delete result._id

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.UPDATED_DOCUMENT_SUCCESSFULLY,
					data: result,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Add project.
	 * @method
	 * @name add
	 * @param {Object} data - body data.
	 * @param {String} userId - Logged in user id.
	 * @param {String} userToken - User token.
	 * @param {String} [appName = ""] - App Name.
	 * @param {String} [appVersion = ""] - App Version.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Project created information.
	 */

	static add(data, userId, userToken, appName = '', appVersion = '', userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const projectsModel = Object.keys(schemas['projects'].schema)
				const booleanData = this.booleanData(schemas['projects'].schema)
				const mongooseIdData = this.mongooseIdData(schemas['projects'].schema)

				//Fetch user profile information by calling user service.
				let userProfile = await projectService.profileRead(userToken)
				// // Check if the user profile fetch was successful
				if (!userProfile.success) {
					throw {
						message: CONSTANTS.apiResponses.USER_DATA_FETCH_UNSUCCESSFUL,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				let createNewProgram = false
				if (data.program._id && data.program._id !== '') {
					createNewProgram = false
				} else if (data.program.name && data.program.name != '') {
					createNewProgram = true
				}

				// Fetch program details
				if (!createNewProgram) {
					const program = await programQueries.programsDocument(
						{
							_id: ObjectId(data.program._id),
							tenantId: userDetails.userInformation.tenantId,
						},
						'all'
					)
					if (!program || !(Object.keys(program).length > 0)) {
						throw {
							success: false,
							message: CONSTANTS.apiResponses.PROGRAM_NOT_FOUND,
						}
					}
				}

				// Throw error if project array is not present in the req.body
				if (!data.projects || !(data.projects.length > 0)) {
					throw {
						success: false,
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_DATA_NOT_FOUND,
					}
				}

				let programAndMultipleSolutionsData
				const projectManatoryFields = ['duration', 'endDate', 'source', 'startDate', 'status', 'tasks', 'title']
				const tasksMandatoryFields = ['name']
				let solutionsData = []

				// Iterate over each project and check for mandatory fields
				for (const project of data.projects) {
					// Check mandatory fields in each project
					for (const field of projectManatoryFields) {
						if (!(field in project)) {
							throw {
								success: false,
								status: HTTP_STATUS_CODE.bad_request.status,
								message: CONSTANTS.apiResponses.PROJECT_MANDATORY_FIELDS_MISSING,
							}
						}
					}

					for (const task of project.tasks) {
						// Check mandatory fields in each task object
						for (const field of tasksMandatoryFields) {
							if (!(field in task)) {
								throw {
									success: false,
									status: HTTP_STATUS_CODE.bad_request.status,
									message: CONSTANTS.apiResponses.TASK_MANDATORY_FIELDS_MISSING,
								}
							}
						}
					}
					solutionsData.push({
						name: project.title ? project.title : '',
						description: project.description ? project.description : '',
						startDate: project.startDate ? project.startDate : '',
						endDate: project.endDate ? project.endDate : '',
					})
				}
				// Create programs & solutions
				programAndMultipleSolutionsData = await this.createProgramAndMultipleSolutions(
					data.program,
					solutionsData,
					userId,
					true,
					userDetails
				)
				if (
					!programAndMultipleSolutionsData.success ||
					!programAndMultipleSolutionsData.data ||
					!(Object.keys(programAndMultipleSolutionsData.data).length > 0)
				) {
					throw {
						success: false,
						message: CONSTANTS.apiResponses.SOLUTION_PROGRAMS_NOT_CREATED,
					}
				}

				// Create programInformation object to store in projects
				let programInformation = {}
				programInformation['_id'] = programAndMultipleSolutionsData.data.program._id
				programInformation['isAPrivateProgram'] = programAndMultipleSolutionsData.data.program.isAPrivateProgram
				programInformation['externalId'] = programAndMultipleSolutionsData.data.program.externalId
				programInformation['name'] = programAndMultipleSolutionsData.data.program.name
				programInformation['description'] = programAndMultipleSolutionsData.data.program.description

				let userCreatedProjects = []

				for (const project of data.projects) {
					// Create unique id to each task
					for (let task of project.tasks) {
						task['isDeletable'] = task.hasOwnProperty('isDeletable') ? task['isDeletable'] : false
						task['_id'] = uuidv4()
					}
					let taskReport = {}

					// Call _projectTask to create an object with all the other necessary fields
					project.tasks = await _projectTask(project.tasks)
					taskReport.total = project.tasks.length

					project.tasks.forEach((task) => {
						if (task.isDeleted == false) {
							if (!taskReport[task.status]) {
								taskReport[task.status] = 1
							} else {
								taskReport[task.status] += 1
							}
						} else {
							taskReport.total = taskReport.total - 1
						}
					})
					project['taskReport'] = taskReport

					// Attach programInformation to each project
					project['programInformation'] = programInformation
					project['programId'] = programInformation._id
					project['programExternalId'] = programInformation.externalId
					project['isAPrivateProgram'] = programInformation.isAPrivateProgram

					// Attach app information to each project
					project['appInformation'] = {}
					if (appName !== '') {
						project['appInformation']['appName'] = appName
					}

					if (appVersion !== '') {
						project['appInformation']['appVersion'] = appVersion
					}

					project['lastDownloadedAt'] = new Date()

					if (data.profileInformation) {
						project.userRoleInformation = project.profileInformation
					}

					project.status = UTILS.convertProjectStatus(project.status)

					// Fetch and attach category information to each project
					project['category'] = project['category']
						? project['category']
						: [process.env.DEFAULT_PROJECT_CATEGORY]
					const categories = await projectCategoriesQueries.categoryDocuments(
						{
							externalId: { $in: project.category },
							tenantId: userDetails.userInformation.tenantId,
						},
						['_id', 'name', 'externalId', 'evidences']
					)
					project['categories'] = categories
					project['userId'] = project['createdBy'] = project['updatedBy'] = userId

					// Attach solution information to each project
					for (const solution of programAndMultipleSolutionsData.data.solutions) {
						if (solution.name == project.title) {
							project['solutionInformation'] = {
								_id: solution._id,
								externalId: solution.externalId,
								name: solution.name,
								reflectionEnabled: solution.reflectionEnabled,
							}
							project['solutionExternalId'] = solution.externalId
							project['solutionId'] = solution._id
							break
						}
					}

					// Iterate over each key in the current project object
					Object.keys(project).forEach((updateData) => {
						// Check if the current field is falsy (null, undefined, etc.) and is part of the project's data model
						if (!project[updateData] && projectsModel.includes(updateData)) {
							// If the field is expected to be a boolean, convert its string value to a boolean
							if (booleanData.includes(updateData)) {
								project[updateData] = UTILS.convertStringToBoolean(project[updateData])
							}
							// If the field is expected to be a MongoDB ObjectId, convert it from string to ObjectId
							else if (mongooseIdData.includes(updateData)) {
								project[updateData] = ObjectId(project[updateData])
							} else {
								project[updateData] = project[updateData]
							}
						}
					})

					// Attach userProfile to each project
					project['userProfile'] = userProfile.data
					project['tenantId'] = userDetails.userInformation.tenantId
					project['orgId'] = userDetails.userInformation.organizationId
					let userProject = await projectQueries.createProject(project)
					userCreatedProjects.push(userProject)

					let kafkaUserProject = {
						userId: userId,
						projects: userProject,
					}
					// Push the project to kafka
					await this.attachEntityInformationIfExists(userProject)
					await kafkaProducersHelper.pushProjectToKafka(userProject)
					await kafkaProducersHelper.pushUserActivitiesToKafka(kafkaUserProject)
				}
				let allProjectsData = []
				// Maintain the order of projects
				for (const project of data.projects) {
					for (const item of userCreatedProjects) {
						if (project.title == item.title) {
							allProjectsData.push({
								_id: item._id,
								lastDownloadedAt: item.lastDownloadedAt,
							})
							break
						}
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_CREATED,
					data: {
						programId:
							programAndMultipleSolutionsData.data.program &&
							programAndMultipleSolutionsData.data.program._id
								? programAndMultipleSolutionsData.data.program._id
								: data.program._id,
						projects: allProjectsData,
					},
					result: {
						programId:
							programAndMultipleSolutionsData.data.program &&
							programAndMultipleSolutionsData.data.program._id
								? programAndMultipleSolutionsData.data.program._id
								: data.program._id,
						projects: allProjectsData,
					},
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * share project and task pdf report.
	 * @method
	 * @name share
	 * @param {String} [projectId] 		- projectId.
	 * @param {Array} [projectId] 		- project task ids.
	 * @param {String} [userId] 		- UserId.
	 * @param {String} [appVersion] 	- appVersion.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Downloadable pdf url.
	 */

	static share(projectId = '', taskIds = [], userId, appVersion, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let projectPdf = true
				let projectDocument = []
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId

				let query = {
					_id: projectId,
					isDeleted: false,
					tenantId: tenantId,
				}

				if (!taskIds.length) {
					projectDocument = await projectQueries.projectDocument(query, [
						'title',
						'status',
						'metaInformation.goal',
						'metaInformation.duration',
						'startDate',
						'description',
						'endDate',
						'tasks',
						'categories',
						'programInformation.name',
						'recommendedFor',
						'link',
						'remarks',
						'attachments',
						'taskReport.completed',
					])
				} else {
					projectPdf = false

					let aggregateData = [
						{ $match: { _id: ObjectId(projectId), isDeleted: false, tenantId: tenantId } },
						{
							$project: {
								status: 1,
								title: 1,
								startDate: 1,
								'metaInformation.goal': 1,
								'metaInformation.duration': 1,
								categories: 1,
								'programInformation.name': 1,
								description: 1,
								recommendedFor: 1,
								link: 1,
								remarks: 1,
								attachments: 1,
								'taskReport.completed': 1,
								tasks: 1,
								filteredTasks: {
									$filter: {
										input: '$tasks',
										as: 'tasks',
										cond: { $in: ['$$tasks._id', taskIds] },
									},
								},
							},
						},
					]

					projectDocument = await projectQueries.getAggregate(aggregateData)
				}

				if (!projectDocument.length) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				projectDocument = projectDocument[0]
				projectDocument.goal = projectDocument.metaInformation ? projectDocument.metaInformation.goal : ''
				projectDocument.duration = projectDocument.metaInformation
					? projectDocument.metaInformation.duration
					: ''
				projectDocument.programName = projectDocument.programInformation
					? projectDocument.programInformation.name
					: ''
				projectDocument.remarks = projectDocument.remarks ? projectDocument.remarks : ''
				projectDocument.taskcompleted = projectDocument.taskReport.completed
					? projectDocument.taskReport.completed
					: CONSTANTS.common.DEFAULT_TASK_COMPLETED

				//store tasks and attachment data into object
				let projectFilter = {
					tasks: projectDocument.filteredTasks ? projectDocument.filteredTasks : projectDocument.tasks,
					attachments: projectDocument.attachments,
				}

				//returns project tasks and attachments with downloadable urls
				let projectDataWithUrl = await _projectInformation(projectFilter)

				//replace projectDocument Data
				if (
					projectDataWithUrl.success &&
					projectDataWithUrl.data &&
					projectDataWithUrl.data.tasks &&
					projectDataWithUrl.data.tasks.length > 0
				) {
					if (projectDocument.filteredTasks) {
						projectDocument.filteredTasks = projectDataWithUrl.data.tasks
					} else {
						projectDocument.tasks = projectDataWithUrl.data.tasks
					}
				}

				if (
					projectDataWithUrl.success &&
					projectDataWithUrl.data &&
					projectDataWithUrl.data.attachments &&
					projectDataWithUrl.data.attachments.length > 0
				) {
					projectDocument.attachments = projectDataWithUrl.data.attachments
				}

				//get image link and other document links
				let imageLink = []
				let evidenceLink = []
				if (projectDocument.attachments && projectDocument.attachments.length > 0) {
					projectDocument.attachments.forEach((attachment) => {
						if (attachment.type.includes('image/') && attachment.url && attachment.url !== '') {
							imageLink.push(attachment.url)
						} else if (
							attachment.type == CONSTANTS.common.ATTACHMENT_TYPE_LINK &&
							attachment.name &&
							attachment.name !== ''
						) {
							let data = {
								type: attachment.type,
								url: attachment.name,
							}
							evidenceLink.push(data)
						} else if (attachment.url && attachment.url !== '') {
							let data = {
								type: attachment.type,
								url: attachment.url,
							}
							evidenceLink.push(data)
						}
					})
				}

				projectDocument.evidenceLink = evidenceLink
				projectDocument.imageLink = imageLink

				projectDocument.category = []

				if (projectDocument.categories && projectDocument.categories.length > 0) {
					projectDocument.categories.forEach((category) => {
						projectDocument.category.push(category.name)
					})
				}

				projectDocument.recommendedForRoles = []

				if (projectDocument.recommendedFor && projectDocument.recommendedFor.length > 0) {
					projectDocument.recommendedFor.forEach((recommend) => {
						projectDocument.recommendedForRoles.push(recommend)
					})
				}

				let tasks = []
				if (projectDocument.tasks.length > 0) {
					projectDocument.tasks.forEach((task) => {
						let subtasks = []
						if (!task.isDeleted) {
							if (task.children.length > 0) {
								task.children.forEach((children) => {
									if (!children.isDeleted) {
										subtasks.push(children)
									}
								})
							}
							task.children = subtasks
							tasks.push(task)
						}
					})
					projectDocument.tasks = tasks
				}

				delete projectDocument.categories
				delete projectDocument.metaInformation
				delete projectDocument.programInformation
				delete projectDocument.recommendedFor

				if (UTILS.revertStatusorNot(appVersion)) {
					projectDocument.status = UTILS.revertProjectStatus(projectDocument.status)
				}
				let response
				// if projectpdf is requested generate that else project task pdf can be called
				if (projectPdf) {
					response = await common_handler.improvementProjectPdfGeneration(projectDocument, userId)
				} else {
					response = await common_handler.improvementProjectTaskPdfGeneration(projectDocument, userId)
				}

				if (response && response.success && response.folderPath != '') {
					const downloadUrl = `${process.env.ELEVATE_PROJECT_SERVICE_URL}/${process.env.SERVICE_NAME}${CONSTANTS.endpoints.AUTO_DOWNLOAD}?file=${response.folderPath}`
					return resolve({
						success: true,
						message: CONSTANTS.apiResponses.REPORT_GENERATED_SUCCESSFULLY,
						data: {
							downloadUrl,
						},
						result: {
							downloadUrl,
						},
					})
				} else {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.COULD_NOT_GENERATE_PDF_REPORT,
					}
				}
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
					result: {},
				})
			}
		})
	}

	/**
	 * Get list of user projects with the targetted ones.
	 * @method
	 * @name userAssigned
	 * @param {String} userId - Logged in user id.
	 * @param {Number} pageSize - Page size.
	 * @param {Number} pageNo - Page No.
	 * @param {String} search - Search text.
	 * @param {String} filter - filter text.
	 * @returns {Object}
	 */

	static userAssigned(userId, pageSize, pageNo, search, filter) {
		return new Promise(async (resolve, reject) => {
			try {
				let query = {
					userId: userId,
					isDeleted: false,
				}

				let searchQuery = []

				if (search !== '') {
					searchQuery = [{ title: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }]
				}

				if (filter && filter !== '') {
					if (filter === CONSTANTS.common.CREATED_BY_ME) {
						query['referenceFrom'] = {
							$ne: CONSTANTS.common.LINK,
						}
						query['isAPrivateProgram'] = {
							$ne: false,
						}
					} else if (filter == CONSTANTS.common.ASSIGN_TO_ME) {
						query['isAPrivateProgram'] = false
					} else {
						query['referenceFrom'] = CONSTANTS.common.LINK
					}
				}

				let projects = await this.projects(query, pageSize, pageNo, searchQuery, [
					'title',
					'description',
					'solutionId',
					'programId',
					'programInformation.name',
					'projectTemplateId',
					'solutionExternalId',
					'lastDownloadedAt',
					'hasAcceptedTAndC',
					'referenceFrom',
					'status',
					'certificate',
				])

				let totalCount = 0
				let data = []
				if (
					projects.success &&
					projects.data &&
					projects.data.data &&
					Object.keys(projects.data.data).length > 0
				) {
					totalCount = projects.data.count
					data = projects.data.data

					if (data.length > 0) {
						let templateFilePath = []
						data.forEach((projectData) => {
							projectData.name = projectData.title

							if (projectData.programInformation) {
								projectData.programName = projectData.programInformation.name
								delete projectData.programInformation
							}

							if (projectData.solutionExternalId) {
								projectData.externalId = projectData.solutionExternalId
								delete projectData.solutionExternalId
							}

							projectData.type = CONSTANTS.common.IMPROVEMENT_PROJECT
							delete projectData.title

							if (
								projectData.certificate &&
								projectData.certificate.transactionId &&
								projectData.certificate.transactionId !== '' &&
								projectData.certificate.pdfPath &&
								projectData.certificate.pdfPath !== '' &&
								projectData.certificate.svgPath &&
								projectData.certificate.svgPath !== ''
							) {
								templateFilePath.push(projectData.certificate.pdfPath, projectData.certificate.svgPath)
							}
						})

						if (templateFilePath.length > 0) {
							let certificateTemplateDownloadableUrl = await cloudServicesHelper.getDownloadableUrl(
								templateFilePath
							)
							if (
								!certificateTemplateDownloadableUrl ||
								!certificateTemplateDownloadableUrl.result ||
								!certificateTemplateDownloadableUrl.result.length > 0
							) {
								throw {
									message: CONSTANTS.apiResponses.DOWNLOADABLE_URL_NOT_FOUND,
								}
							}
							// map downloadable templateUrl to corresponding project data
							data.forEach((projectData) => {
								if (projectData.certificate) {
									var pdfItemFromUrlArray = certificateTemplateDownloadableUrl.result.find(
										(item) => item.payload['sourcePath'] == projectData.certificate.pdfPath
									)
									if (pdfItemFromUrlArray) {
										projectData.certificate.certificatePdfUrl = pdfItemFromUrlArray.url
									}

									var svgItemFromUrlArray = certificateTemplateDownloadableUrl.result.find(
										(item) => item.payload['sourcePath'] == projectData.certificate.svgPath
									)
									if (svgItemFromUrlArray) {
										projectData.certificate.certificateSvgUrl = svgItemFromUrlArray.url
									}
								}
							})
						}
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.USER_ASSIGNED_PROJECT_FETCHED,
					data: {
						data: data,
						count: totalCount,
					},
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					data: {
						description: CONSTANTS.common.PROJECT_DESCRIPTION,
						data: [],
						count: 0,
					},
				})
			}
		})
	}

	/**
	 * List of user imported projects.
	 * @method
	 * @name importedProjects
	 * @param {String} userId - Logged in user id.
	 * @param {String} programId - program id.
	 * @returns {Object}
	 */

	static importedProjects(userId, programId) {
		return new Promise(async (resolve, reject) => {
			try {
				let filterQuery = {
					userId: userId,
					// referenceFrom : { $exists : true,$eq : CONSTANTS.common.OBSERVATION_REFERENCE_KEY }, - Commented as this filter is not useful. - 4.7 Sprint - 25Feb2022
					isDeleted: false,
				}

				if (programId !== '') {
					filterQuery['programId'] = programId
				}
				let importedProjects = await projectQueries.projectDocument(filterQuery, [
					'solutionInformation',
					'programInformation',
					'title',
					'description',
					'projectTemplateId',
					'certificate',
				])

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.IMPORTED_PROJECTS_FETCHED,
					data: importedProjects,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					data: {
						description: CONSTANTS.common.PROJECT_DESCRIPTION,
						data: [],
						count: 0,
					},
				})
			}
		})
	}

	/**
	 * List of user projects.
	 * @method
	 * @name list
	 * @param {String} userId -UserID
	 * @param {Number} pageNo -Page number
	 * @param {Number} pageSize -Page size
	 * @param {String} searchText -Search text
	 * @param {String} language -LanguageCode
	 * @param {String} programId - ProgramId
	 * @param {String} status  -status of the project,
	 * @param {Object} userDetails - user related info
	 * @returns {Array} List of projects.
	 */

	static list(userId, pageNo, pageSize, searchText, language = '', programId, status, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let aggregateData = []
				// Match Query
				let matchQuery = {
					$match: {
						userId: userId,
					},
				}

				const tenantId = userDetails.userInformation.tenantId
				const orgId = userDetails.userInformation.organizationId

				matchQuery['$match']['tenantId'] = tenantId

				// pass matchQuery based on reflection
				if (process.env.ENABLE_REFLECTION === 'true') {
					matchQuery.$match['reflection.status'] =
						status === CONSTANTS.common.COMPLETED_STATUS
							? { $eq: CONSTANTS.common.COMPLETED_STATUS } // Completed
							: { $ne: CONSTANTS.common.COMPLETED_STATUS }
					// When ProgramId passed match based on that
					if (programId) {
						matchQuery.$match.programId = new ObjectId(programId)
					}
				} else {
					matchQuery.$match.status =
						status === CONSTANTS.common.COMPLETED_STATUS
							? { $eq: CONSTANTS.common.SUBMITTED_STATUS } // Completed
							: { $ne: CONSTANTS.common.SUBMITTED_STATUS }
				}
				let searchData = [
					{
						title: new RegExp(searchText, 'i'),
					},
				]
				if (searchText !== '') {
					if (matchQuery['$match']['$and']) {
						matchQuery['$match']['$and'].push({ $or: searchData })
					} else {
						matchQuery['$match']['$or'] = searchData
					}
				}
				aggregateData.push(matchQuery)
				// Projection aggregate for multilingual
				let titleField = language ? `$translations.${language}.title` : '$title'
				let descriptionField = language ? `$translations.${language}.description` : '$description'
				aggregateData.push({
					$project: {
						_id: 1,
						title: { $ifNull: [titleField, '$title'] },
						description: { $ifNull: [descriptionField, '$description'] },
						projectTemplateId: 1,
						projectTemplateExternalId: 1,
						status: 1,
						tasks: 1,
						taskReport: 1,
						createdAt: 1,
						startDate: 1,
						endDate: 1,
						programInformation: {
							name: 1,
						},
						attachments: 1,
						reflection: 1,
						completedDate: 1,
					},
				})

				aggregateData.push(
					{
						$sort: { createdAt: -1 }, // Descending order (latest first)
					},
					{
						// Pagination
						$facet: {
							totalCount: [{ $count: 'count' }],
							data: [{ $skip: pageSize * (pageNo - 1) }, { $limit: pageSize }],
						},
					},

					{
						// Count and project the response data
						$project: {
							data: 1,
							count: {
								$ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0],
							},
						},
					}
				)

				let projects = await projectQueries.getAggregate(aggregateData)
				//Getting tasks translated if required and downloadUrls
				if ((language != '' || status === CONSTANTS.common.COMPLETED_STATUS) && projects[0].data.length > 0) {
					for (const eachProject of projects[0].data) {
						await _projectInformation(eachProject, language)
					}
				}

				// Add programName to the response
				let programData
				if (programId != '' && UTILS.isValidMongoId(programId)) {
					programData = await programQueries.programsDocument({
						_id: ObjectId(programId),
						tenantId,
					})
					if (!(programData.length > 0)) {
						throw {
							success: false,
							status: HTTP_STATUS_CODE.not_found.status,
							message: CONSTANTS.apiResponses.PROGRAM_NOT_FOUND,
						}
					}
					projects[0]['programName'] = programData[0].name
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					result: projects[0],
				})
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Create project from template.
	 * @method
	 * @name importFromLibrary
	 * @param {String} projectTemplateId - project template id.
	 * @param {Object} requestedData - body data.
	 * @param {String} userId - Logged in user id.
	 * @param {String} userToken - User token.
	 * @param {Boolean} isATargetedSolution - User targeted or not .
	 * @param {String} language - language code
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Project created information.
	 * @param {Boolean} isExternalProgram - Flag to check if it is an external program (If true then program is present in survey service.If false program is present in project service).
	 */

	static importFromLibrary(
		projectTemplateId,
		requestedData,
		userToken,
		userId,
		isATargetedSolution = false,
		language,
		userDetails,
		isExternalProgram
	) {
		return new Promise(async (resolve, reject) => {
			try {
				isATargetedSolution = UTILS.convertStringToBoolean(isATargetedSolution)
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				// Fetch project template details based on thr projectTemplate ID
				// Will fetch matched projectTemplate if isDeleted = false && status = published
				let libraryProjects = await libraryCategoriesHelper.projectDetails(
					projectTemplateId,
					'',
					isATargetedSolution,
					language,
					userDetails
				)
				// If template data is not found throw error
				if (libraryProjects.data && !Object.keys(libraryProjects.data).length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				// If an entityId is passed in body data. we need to varify if it is a valid entity
				// If not a valid entity throw error
				// If it is valid make sure we add those data to newly creating projects
				if (requestedData.entityId && requestedData.entityId !== '') {
					let entityInformation = await entitiesService.entityDocuments(
						{ _id: requestedData.entityId, tenantId: tenantId },
						CONSTANTS.common.ALL
					)

					if (!entityInformation?.success || !entityInformation?.data?.length > 0) {
						return resolve({
							success: false,
							message: 'Entity information not found for the given entityId',
						})
					}

					libraryProjects.data['entityInformation'] = entityInformation.data[0]
					libraryProjects.data.entityId = entityInformation.data[0]._id
				}

				if (requestedData.solutionId && requestedData.solutionId !== '' && isATargetedSolution === false) {
					let programAndSolutionInformation = await this.createProgramAndSolution(
						requestedData.programId,
						requestedData.programName,
						requestedData.entityId ? [requestedData.entityId] : '',
						userId,
						requestedData.solutionId,
						isATargetedSolution,
						userDetails,
						isExternalProgram
					)

					if (!programAndSolutionInformation.success) {
						return resolve(programAndSolutionInformation)
					}

					libraryProjects.data = _.merge(libraryProjects.data, programAndSolutionInformation.data)

					libraryProjects.data['referenceFrom'] = CONSTANTS.common.LINK
				} else if (
					(requestedData.programId && requestedData.programId !== '') ||
					(requestedData.programName && requestedData.programName !== '')
				) {
					let programAndSolutionInformation = await this.createProgramAndSolution(
						requestedData.programId,
						requestedData.programName,
						requestedData.entityId ? [requestedData.entityId] : '',
						userId,
						'',
						false,
						userDetails,
						isExternalProgram
					)

					if (!programAndSolutionInformation.success) {
						return resolve(programAndSolutionInformation)
					}

					if (
						libraryProjects.data['entityInformation'] &&
						libraryProjects.data.entityType &&
						libraryProjects.data.entityType !==
							programAndSolutionInformation.data.solutionInformation.entityType
					) {
						throw {
							message: CONSTANTS.apiResponses.ENTITY_TYPE_MIS_MATCHED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}

					libraryProjects.data = _.merge(libraryProjects.data, programAndSolutionInformation.data)
				}

				if (requestedData.referenceFrom && requestedData.referenceFrom !== '') {
					libraryProjects.data.referenceFrom = requestedData.referenceFrom
				}

				let taskReport = {}
				// If template contains project task process the task data
				if (libraryProjects?.data?.tasks && libraryProjects?.data?.tasks?.length > 0) {
					libraryProjects.data.tasks = await _projectTask(
						libraryProjects.data.tasks,
						isATargetedSolution === false ? false : true,
						'',
						userToken,
						libraryProjects.data.programId,
						userDetails
					)
					taskReport.total = libraryProjects.data.tasks.length

					libraryProjects.data.tasks.forEach((task) => {
						if (task.isDeleted == false) {
							if (!taskReport[task.status]) {
								taskReport[task.status] = 1
							} else {
								taskReport[task.status] += 1
							}
						} else {
							//reduce total count if task is deleted.
							taskReport.total = taskReport.total - 1
						}
					})

					libraryProjects.data['taskReport'] = taskReport
				}
				//  <- Add certificate template data
				// if (libraryProjects.data.certificateTemplateId && libraryProjects.data.certificateTemplateId !== '') {
				// 	// <- Add certificate template details to projectCreation data if present ->
				// 	const certificateTemplateDetails = await certificateTemplateQueries.certificateTemplateDocument({
				// 		_id: libraryProjects.data.certificateTemplateId,
				// 	})

				// 	// create certificate object and add data if certificate template is present.
				// 	if (certificateTemplateDetails.length > 0) {
				// 		libraryProjects.data['certificate'] = _.pick(certificateTemplateDetails[0], [
				// 			'templateUrl',
				// 			'status',
				// 			'criteria',
				// 		])
				// 	}
				// 	libraryProjects.data['certificate']['templateId'] = libraryProjects.data.certificateTemplateId
				// 	delete libraryProjects.data.certificateTemplateId
				// }

				//Fetch user profile information.
				let addReportInfoToSolution = false
				let userProfile = await userService.profile(userId, userToken)
				// Check if the user profile fetch was successful
				if (!userProfile.success) {
					throw {
						message: CONSTANTS.apiResponses.USER_DATA_FETCH_UNSUCCESSFUL,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				if (userProfile.success && userProfile.data) {
					libraryProjects.data.userProfile = userProfile.data
					// addReportInfoToSolution = true
				}

				libraryProjects.data.userId = libraryProjects.data.updatedBy = libraryProjects.data.createdBy = userId
				libraryProjects.data.lastDownloadedAt = new Date()
				libraryProjects.data.status = CONSTANTS.common.STARTED
				// adding startDate and Endate based on createdAt and duration
				if (!requestedData.startDate && !requestedData.endDate && libraryProjects.data.durationInDays) {
					libraryProjects.data.startDate = new Date()
					libraryProjects.data.endDate = UTILS.calculateEndDate(
						new Date(),
						libraryProjects.data.durationInDays
					)
				}
				if (requestedData.startDate) {
					libraryProjects.data.startDate = requestedData.startDate
				}

				if (requestedData.endDate) {
					libraryProjects.data.endDate = requestedData.endDate
				}

				if (requestedData.hasAcceptedTAndC) {
					libraryProjects.data.hasAcceptedTAndC = true
				}
				if (requestedData.project) {
					libraryProjects.data['project'] = requestedData.project
					libraryProjects.data['referenceFrom'] = CONSTANTS.common.PROJECT
				}
				libraryProjects.data.projectTemplateId = libraryProjects.data._id
				libraryProjects.data.projectTemplateExternalId = libraryProjects.data.externalId
				libraryProjects.data['tenantId'] = userDetails.userInformation.tenantId
				libraryProjects.data['orgId'] = userDetails.userInformation.organizationId // libraryProjects.data.entityType =libraryProjects.data.entityType
				libraryProjects.data.entityInformation = { entityType: libraryProjects.data.entityType }
				let projectCreation = await projectQueries.createProject(_.omit(libraryProjects.data, ['_id']))

				// if (addReportInfoToSolution && projectCreation._doc.solutionId) {
				// 	let updateSolution = await solutionsHelper.addReportInformationInSolution(
				// 		projectCreation._doc.solutionId,
				// 		projectCreation._doc.userProfile
				// 	)
				// }
				let kafkaUserProject = {
					userId: userId,
					projects: projectCreation,
				}
				await this.attachEntityInformationIfExists(projectCreation)
				await kafkaProducersHelper.pushProjectToKafka(projectCreation)
				await kafkaProducersHelper.pushUserActivitiesToKafka(kafkaUserProject)

				// update submission data for project as task
				if (projectCreation.project && projectCreation.referenceFrom === CONSTANTS.common.PROJECT) {
					let updateTaskSubmissionData = {
						_id: projectCreation._id,
						status: projectCreation.status,
						completedDate: projectCreation.completedDate ? projectCreation.completedDate : '',
					}
					await this.pushSubmissionToTask(
						projectCreation.project._id,
						projectCreation.project.taskId,
						updateTaskSubmissionData
					)
				}

				if (requestedData.rating && requestedData.rating > 0) {
					await projectTemplatesHelper.ratings(projectTemplateId, requestedData.rating, userToken)
				}
				// get translation data and modify actual data
				if (
					language !== '' &&
					projectCreation._doc.translations &&
					projectCreation._doc.translations[language]
				) {
					projectCreation._doc = UTILS.getTranslatedData(
						projectCreation._doc,
						projectCreation._doc.translations[language]
					)
				}
				//Once modified remove translations from response
				projectCreation._doc = _.omit(projectCreation._doc, 'translations')
				projectCreation = await _projectInformation(_.omit(projectCreation._doc, ['certificate']), language)

				// increment the importCount field in the projectTemplate once the project is created successfully
				if (projectCreation.success) {
					let updateProjectTemplateImportCount = libraryProjects.data.importCount
						? libraryProjects.data.importCount + 1
						: 1
					let updatedProjectTemplate = await projectTemplateQueries.findOneAndUpdate(
						{
							_id: projectTemplateId,
							tenantId: userDetails.userInformation.tenantId,
						},
						{
							$set: { importCount: updateProjectTemplateImportCount },
						}
					)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					data: projectCreation.data,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * get project details.
	 * @method
	 * @name userProject
	 * @param {String} projectId - project id.
	 * @returns {Object} Project details.
	 */

	static userProject(projectId) {
		return new Promise(async (resolve, reject) => {
			try {
				const projectDetails = await projectQueries.projectDocument(
					{
						_id: projectId,
					},
					'all'
				)

				if (!projectDetails.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_DETAILS_FETCHED,
					data: projectDetails[0],
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * generate project certificate.
	 * @method
	 * @name generateCertificate
	 * @param {Object} data - project data for certificate creation data.
	 * @returns {JSON} certificate details.
	 */

	static generateCertificate(data) {
		return new Promise(async (resolve, reject) => {
			try {
				// check eligibility of project for certificate creation
				let eligibility = await this.checkCertificateEligibility(data)
				if (!eligibility) {
					throw {
						message: CONSTANTS.apiResponses.NOT_ELIGIBLE_FOR_CERTIFICATE,
					}
				}

				// create payload for certificate generation
				const certificateData = await this.createCertificatePayload(data)

				// call certificateService to create certificate for project
				const certificate = await this.createCertificate(certificateData, data._id)

				return resolve(certificate)
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
				})
			}
		})
	}

	/**
	 * check project eligibility for certificate.
	 * @method
	 * @name checkCertificateEligibility
	 * @param {Object} data - project data for certificate creation data.
	 * @returns {Boolean} certificate eligibilty status.
	 */

	static checkCertificateEligibility(data) {
		return new Promise(async (resolve, reject) => {
			try {
				let eligible = false
				let updateObject = {
					$set: {},
				}
				//  validate certificate data, checking if it passes all criteria
				let validateCriteria = await certificateValidationsHelper.criteriaValidation(data)
				if (validateCriteria.success) {
					eligible = true
				} else {
					updateObject['$set']['certificate.message'] = validateCriteria.message
				}
				updateObject['$set']['certificate.eligible'] = eligible

				// update project certificate data
				await projectQueries.findOneAndUpdate(
					{
						_id: data._id,
					},
					updateObject
				)

				return resolve(eligible)
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
				})
			}
		})
	}

	/**
	 * createCertificatePayload.
	 * @method
	 * @name createCertificatePayload
	 * @param {Object} data - project data for certificate creation data.
	 * @returns {Object} payload for certificate creation.
	 */

	static createCertificatePayload(data) {
		return new Promise(async (resolve, reject) => {
			try {
				// Truncate the title if it exceeds 42 characters
				if (data.title.length > 42) {
					data.title = data.title.substring(0, 42) + '...'
				}

				// Get downloadable URL for the certificate template
				if (data.certificate.templateUrl && data.certificate.templateUrl !== '') {
					let certificateTemplateDownloadableUrl = await cloudServicesHelper.getDownloadableUrl([
						data.certificate.templateUrl,
					])
					// If a downloadable URL is found, update the template URL
					if (
						certificateTemplateDownloadableUrl.result &&
						certificateTemplateDownloadableUrl.result.length > 0
					) {
						data.certificate.templateUrl = certificateTemplateDownloadableUrl.result[0].url
					} else {
						// Throw an error if the downloadable URL is not found
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.DOWNLOADABLE_URL_NOT_FOUND,
						}
					}
				}

				let certificateTemplateDetails = []
				// Fetch certificate template details if the template ID is provided
				if (data.certificate.templateId && data.certificate.templateId !== '') {
					certificateTemplateDetails = await certificateTemplateQueries.certificateTemplateDocument(
						{
							_id: data.certificate.templateId,
						},
						['issuer', 'solutionId', 'programId']
					)

					// Throw an error if certificate template data does not exist
					if (!certificateTemplateDetails.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.CERTIFICATE_TEMPLATE_NOT_FOUND,
						}
					}
				}

				// Truncate the user-name if it exceeds 38 characters
				if (data.userProfile.name.length > 38) {
					data.userProfile.name = data.userProfile.name.substring(0, 38) + '...'
				}

				// Create the certificate request body
				let certificateData = {
					userId: data.userId,
					name: data.userProfile.name,
					templateUrl: data.certificate.templateUrl,
					issuer: certificateTemplateDetails[0].issuer,
					status: data.certificate.status.toUpperCase(),
					projectId: data._id.toString(),
					projectName: UTILS.handleSpecialCharsForCertificate(data.title),
					programId: certificateTemplateDetails[0].programId.toString(),
					programName:
						data.programInformation && data.programInformation.name ? data.programInformation.name : '',
					solutionId: certificateTemplateDetails[0].solutionId.toString(),
					solutionName:
						data.solutionInformation && data.solutionInformation.name ? data.solutionInformation.name : '',
					completedDate: UTILS.formatISODateToReadableDate(data.completedDate),
				}

				// Populate the SVG template if the template URL is provided
				if (certificateData.templateUrl && certificateData.templateUrl != '') {
					let svgTemplate = await axios.get(certificateData.templateUrl)
					svgTemplate = svgTemplate.data

					const qrCodeData = await QRCode.toDataURL(
						`${process.env.ELEVATE_PROJECT_SERVICE_URL}/${process.env.SERVICE_NAME}/v1/userProjects/verifyCertificate/${certificateData.projectId}`
					)

					const populatedSVGTemplate = svgTemplate
						.replace('{{credentialSubject.recipientName}}', certificateData.name)
						.replace('{{credentialSubject.projectName}}', certificateData.projectName)
						.replace('{{dateFormat issuanceDate "DD MMMM  YYYY"}}', certificateData.completedDate)
						.replace('{{qrCode}}', qrCodeData)

					certificateData['populatedSVGTemplate'] = populatedSVGTemplate
				}
				return resolve(certificateData)
			} catch (error) {
				// Resolve the promise with an error message
				return resolve({
					success: false,
					message: error.message,
				})
			}
		})
	}

	/**
	 * call gotenberg for certificate creation.
	 * @method
	 * @name createCertificate
	 * @param {Object} certificateData - payload for certificate creation data.
	 * @param {string} projectId - project Id.
	 * @param {Boolean} asyncMode - Defines if the certificate callback is async or sync.
	 * @returns {Object} certificate creation status.
	 */

	static createCertificate(certificateData, projectId, asyncMode = true) {
		return new Promise(async (resolve, reject) => {
			try {
				// Define the temporary folder path for the certificate
				const certificateTempFolderPath = path.resolve(__dirname + '/../../certificateTempFolder')

				// Remove the temporary folder if it exists
				if (fs.existsSync(certificateTempFolderPath)) {
					fs.rmSync(certificateTempFolderPath, { recursive: true, force: true })
				}

				// Create the temporary folder
				fs.mkdirSync(certificateTempFolderPath)

				// Generate UUID for svg file
				const dynamicUUIDForSvgFile = UTILS.generateUniqueId()

				// Define the path for the SVG template
				const svgTemplatePath = certificateTempFolderPath + `/${dynamicUUIDForSvgFile}_template.svg`

				// Write the populated SVG template to the file
				fs.writeFileSync(svgTemplatePath, certificateData.populatedSVGTemplate)

				// Read the SVG template and convert it to a single line string
				fs.readFileSync(svgTemplatePath, 'utf-8', (error, data) => {
					if (error) {
						// If there's an error reading the file, clean up and throw an error
						if (fs.existsSync(certificateTempFolderPath)) {
							fs.rmSync(certificateTempFolderPath, { recursive: true, force: true })
						}
						throw {
							message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
						}
					}

					// Replace all whitespace with a single space and trim the string
					const singleLineSvg = data.replace(/\s+/g, ' ').trim()

					// Write the single line SVG back to the file
					fs.writeFileSync(svgTemplatePath, singleLineSvg, 'utf-8', (error) => {
						if (error) {
							// If there's an error writing the file, clean up and throw an error
							if (fs.existsSync(certificateTempFolderPath)) {
								fs.rmSync(certificateTempFolderPath, { recursive: true, force: true })
							}
							throw {
								message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
							}
						}
					})
				})

				const svgUploadDetails = await common_handler.uploadPdfToCloud(
					`${dynamicUUIDForSvgFile}_template.svg`,
					certificateData.userId,
					certificateTempFolderPath
				)

				if (!svgUploadDetails || svgUploadDetails.data == '') {
					throw {
						message: CONSTANTS.apiResponses.FAILED_TO_CREATE_DOWNLOADABLEURL,
					}
				}

				// Update the project in the database
				await projectQueries.findOneAndUpdate(
					{
						_id: projectId,
					},
					{
						$set: {
							'certificate.svgPath': svgUploadDetails.data,
						},
					}
				)
				certificateData['svgTemplatePath'] = svgTemplatePath
				certificateData['certificateTempFolderPath'] = certificateTempFolderPath
				// Call the service to create the certificate and get the details
				const certificateDetails = await gotenbergService.createCertificate(certificateData, asyncMode)
				// Check if the certificate creation was successful
				if (!certificateDetails.success || !certificateDetails.data || !certificateDetails.data.transactionId) {
					throw {
						message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
					}
				}

				let updateObject = {
					$set: {},
				}

				// If a transaction ID is present, update the certificate details
				if (certificateDetails.data.transactionId && certificateDetails.data.transactionId !== '') {
					let transactionIdvalue = certificateDetails.data.transactionId
					updateObject['$set']['certificate.transactionId'] = transactionIdvalue
					updateObject['$set']['certificate.transactionIdCreatedAt'] = new Date()
				}

				if (!asyncMode) {
					// Generate UUID for pdf file
					const dynamicUUIDForPdfFile = UTILS.generateUniqueId()

					// Define the path for the output PDF
					const certificatePdfPath = certificateTempFolderPath + `/${dynamicUUIDForPdfFile}_output.pdf`

					// Write the response data (PDF) to the file
					fs.writeFileSync(certificatePdfPath, certificateDetails.data.gotenbergResponse.data)

					// Upload the PDF and SVG template to the cloud
					const pdfUploadDetails = await common_handler.uploadPdfToCloud(
						`${dynamicUUIDForPdfFile}_output.pdf`,
						certificateData.userId,
						certificateTempFolderPath
					)

					// If the PDF upload was successful, update the project details
					if (pdfUploadDetails.success && pdfUploadDetails.data != '') {
						updateObject['$set']['certificate.pdfPath'] = pdfUploadDetails.data
						updateObject['$set']['certificate.issuedOn'] = new Date()
					}

					// Clean up the temporary folder
					if (fs.existsSync(certificateTempFolderPath)) {
						fs.rmSync(certificateTempFolderPath, { recursive: true, force: true })
					}
				}

				// If there are fields to update, update the project details with the certificate information
				if (Object.keys(updateObject['$set']).length > 0) {
					await projectQueries.findOneAndUpdate(
						{
							_id: projectId,
						},
						updateObject
					)
				}
				// Resolve the promise with success and the transaction ID
				return resolve({
					success: true,
					transactionId: certificateDetails.data.transactionId,
				})
			} catch (error) {
				// Resolve the promise with an error message
				return resolve({
					success: false,
					message: error.message,
				})
			}
		})
	}

	/**
	 * certificate callback
	 * @method
	 * @name certificateCallback
	 * @param {Stream} requestObject - Request object from Gotenberg.
	 * @returns {JSON} certificate data updation details.
	 */

	static certificateCallback(requestObject) {
		return new Promise(async (resolve, reject) => {
			try {
				// Extract the content-disposition header to get the filename
				const contentDisposition = requestObject.headers['content-disposition']
				// Extract the Gotenberg trace header to get the transaction ID
				const transactionId = requestObject.headers['gotenberg-trace']

				// Fetch project details based on the transaction ID
				let projectDetails = await projectQueries.projectDocument({
					'certificate.transactionId': transactionId,
				})

				// If no project details are found, throw an error
				if (!projectDetails || !projectDetails.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
					}
				}

				// Match the filename from the content-disposition header
				const match = contentDisposition && contentDisposition.match(/filename="(.+)"/)
				// Set the filename or default to 'output.pdf' if not found
				let filename = match && match[1] ? match[1] : 'output.pdf'
				// Define the temporary folder path for the certificate
				const certificateTempFolderPath = path.resolve(__dirname + '/../../certificateTempFolder')
				// Define the file path to save the PDF
				const filePath = certificateTempFolderPath + '/' + filename
				// Create a writable stream to the file
				const fileStream = fs.createWriteStream(filePath)

				// Pipe the request stream to the file stream
				requestObject.pipe(fileStream)

				// Handle the end of the request stream
				requestObject.on('end', async () => {
					// Upload the PDF to the cloud and get the pre-signed URL
					const certificatePdfUrl = await common_handler.uploadPdfToCloud(
						filename,
						projectDetails[0].userId,
						certificateTempFolderPath
					)
					let updateObject = {
						$set: {},
					}
					// If the PDF upload was successful, update the project details
					if (certificatePdfUrl.success && certificatePdfUrl.data != '') {
						updateObject['$set']['certificate.pdfPath'] = certificatePdfUrl.data
						updateObject['$set']['certificate.issuedOn'] = new Date()
						let updatedProject = await projectQueries.findOneAndUpdate(
							{
								'certificate.transactionId': transactionId,
							},
							updateObject,
							{ returnDocument: 'after' }
						)
						let kafkaUserProject = {
							userId: projectDetails[0].userId,
							projects: updatedProject,
						}
						// Push the updated project details to Kafka
						await this.attachEntityInformationIfExists(updatedProject)
						await kafkaProducersHelper.pushProjectToKafka(updatedProject)
						await kafkaProducersHelper.pushUserActivitiesToKafka(kafkaUserProject)
					}
					// Clean up the temporary folder
					if (fs.existsSync(certificateTempFolderPath)) {
						fs.rmSync(certificateTempFolderPath, { recursive: true, force: true })
					}
					// Resolve the promise with success
					return resolve({
						success: true,
						message: CONSTANTS.apiResponses.PROJECT_CERTIFICATE_GENERATED,
					})
				})

				// Handle errors during the request stream
				requestObject.on('error', async () => {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
					}
				})
			} catch (error) {
				// Resolve the promise with an error message
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * certificate callback error
	 * @method
	 * @name certificateCallbackError
	 * @param {Stream} requestObject - Request object
	 * @returns {JSON} certificate data updation details.
	 */

	static certificateCallbackError(requestObject) {
		return new Promise(async (resolve, reject) => {
			try {
				// Extract the Gotenberg trace header to get the transaction ID
				const transactionId = requestObject.headers['gotenberg-trace']

				// Fetch project details based on the transaction ID
				const projectDetails = await projectQueries.projectDocument({
					'certificate.transactionId': transactionId,
				})

				// Prepare the update object to set the callback error event and message
				let updateObject = {
					$set: {},
				}
				updateObject['$set']['certificate.callbackErrorEvent'] = true
				updateObject['$set']['certificate.message'] = requestObject.body['message']

				// If project details are found, update the project with the error information
				if (projectDetails && projectDetails.length > 0) {
					await projectQueries.findOneAndUpdate(
						{
							'certificate.transactionId': transactionId,
						},
						updateObject
					)
				}

				// Throw an error to indicate certificate generation failure
				throw {
					status: HTTP_STATUS_CODE.bad_request.status,
					message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
				}
			} catch (error) {
				// Resolve the promise with the error message
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * List user project details with certificate
	 * @method
	 * @name certificates
	 * @param {String} userId - userId.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {JSON} certificate data updation details.
	 */

	static certificates(userId, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				// Get project details for the user that have certificates
				const userProject = await projectQueries.projectDocument(
					{
						userId: userId,
						status: CONSTANTS.common.SUBMITTED_STATUS,
						certificate: { $exists: true },
						tenantId: userDetails.userInformation.tenantId,
					},
					[
						'_id',
						'title',
						'status',
						'programId',
						'solutionId',
						'programInformation.name',
						'solutionInformation.name',
						'certificate.pdfPath',
						'certificate.transactionId',
						'certificate.svgPath',
						'certificate.status',
						'certificate.eligible',
						'certificate.message',
						'certificate.issuedOn',
						'completedDate',
						'userProfile.name',
					]
				)

				// Throw an error if no projects with certificates are found
				if (!userProject.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_WITH_CERTIFICATE_NOT_FOUND,
					}
				}
				let certificateFilePath = []
				// Loop through user projects and collect file paths for certificates
				for (let userProjectPointer = 0; userProjectPointer < userProject.length; userProjectPointer++) {
					if (
						userProject[userProjectPointer].certificate.svgPath &&
						userProject[userProjectPointer].certificate.svgPath !== '' &&
						userProject[userProjectPointer].certificate.pdfPath &&
						userProject[userProjectPointer].certificate.pdfPath !== ''
					) {
						// Add SVG and PDF paths to the list
						certificateFilePath.push(userProject[userProjectPointer].certificate.svgPath)
						certificateFilePath.push(userProject[userProjectPointer].certificate.pdfPath)
					}
					// Restructure the response data
					userProject[userProjectPointer].programName =
						userProject[userProjectPointer].programInformation &&
						userProject[userProjectPointer].programInformation.name
							? userProject[userProjectPointer].programInformation.name
							: ''
					userProject[userProjectPointer].solutionName =
						userProject[userProjectPointer].solutionInformation &&
						userProject[userProjectPointer].solutionInformation.name
							? userProject[userProjectPointer].solutionInformation.name
							: ''
					userProject[userProjectPointer].userName =
						userProject[userProjectPointer].userProfile && userProject[userProjectPointer].userProfile.name
							? userProject[userProjectPointer].userProfile.name
							: ''
					// Remove unnecessary fields
					delete userProject[userProjectPointer].programInformation
					delete userProject[userProjectPointer].solutionInformation
					delete userProject[userProjectPointer].userProfile
				}

				// Update project data with downloadable URLs for certificates
				if (certificateFilePath.length > 0) {
					let certificateFileDownloadableUrl = await cloudServicesHelper.getDownloadableUrl(
						certificateFilePath
					)
					// Throw an error if no downloadable URLs are found
					if (!certificateFileDownloadableUrl.result || !certificateFileDownloadableUrl.result.length > 0) {
						throw {
							message: CONSTANTS.apiResponses.DOWNLOADABLE_URL_NOT_FOUND,
						}
					}
					certificateFileDownloadableUrl = certificateFileDownloadableUrl.result
					// Map downloadable URLs to the corresponding project data
					userProject.forEach((projectData) => {
						// Set SVG path
						var svgLinkFromUrlArray = certificateFileDownloadableUrl.find(
							(item) => item.filePath == projectData.certificate.svgPath
						)
						if (svgLinkFromUrlArray) {
							projectData.certificate.svgPath = svgLinkFromUrlArray.url
						}
						// Set PDF path in the response
						var pdfLinkFromArray = certificateFileDownloadableUrl.find(
							(item) => item.filePath == projectData.certificate.pdfPath
						)
						if (pdfLinkFromArray) {
							projectData.certificate.pdfPath = pdfLinkFromArray.url
						}
					})
				}

				// Count the number of projects with generated certificates
				let count = _.countBy(userProject, (rec) => {
					return rec.certificate && rec.certificate.pdfPath && rec.certificate.pdfPath !== ''
						? 'generated'
						: 'notGenerated'
				})

				// Resolve the promise with the project data and counts
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					data: {
						data: userProject,
						count: userProject.length,
						certificateCount: count.generated,
					},
				})
			} catch (error) {
				// Resolve the promise with an error message
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Re-Issue project certificate
	 * @method
	 * @name certificateReIssue
	 * @param {String} projectId - projectId.
	 * @returns {JSON} certificate re-issued details.
	 */

	static certificateReIssue(projectId, userToken) {
		return new Promise(async (resolve, reject) => {
			try {
				// Get project details for the project that requires certificate re-issue
				const userProject = await projectQueries.projectDocument({
					_id: projectId,
					status: CONSTANTS.common.SUBMITTED_STATUS,
					certificate: { $exists: true },
				})

				// Throw an error if project details are not found
				if (!userProject.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
					}
				}
				let updateObject = {
					$set: {},
				}

				// Fetch user data using userId from the project and call the profile API
				let userProfileData = await userService.profile(userProject[0].userId, userToken)
				if (
					userProfileData.success &&
					userProfileData.data &&
					userProfileData.data.name &&
					userProfileData.data.name !== ''
				) {
					userProject[0].userProfile.name = userProfileData.data.name
				} else {
					// Throw an error if user profile data is not found
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROFILE_NOT_FOUND,
					}
				}

				// Create payload for certificate generation
				const certificateData = await this.createCertificatePayload(userProject[0])

				// Call the certificateService to create a new certificate for the project
				const certificate = await this.createCertificate(certificateData, userProject[0]._id, false)

				// Throw an error if certificate generation failed
				if (!certificate.success) {
					throw {
						message: CONSTANTS.apiResponses.CERTIFICATE_GENERATION_FAILED,
					}
				}

				// Update the project with original transaction information if available
				if (userProject[0].certificate.transactionId) {
					updateObject['$set']['certificate.originalTransactionInformation.transactionId'] =
						userProject[0].certificate.transactionId
				}
				if (userProject[0].certificate.pdfPath) {
					updateObject['$set']['certificate.originalTransactionInformation.pdfPath'] =
						userProject[0].certificate.pdfPath
					updateObject['$set']['certificate.eligible'] = true
					updateObject['$set']['certificate.callbackErrorEvent'] = false
				}
				if (userProject[0].certificate.svgPath) {
					updateObject['$set']['certificate.originalTransactionInformation.svgPath'] =
						userProject[0].certificate.svgPath
				}

				// Update the project with the user's name if available
				if (userProject[0].userProfile.name) {
					updateObject['$set']['userProfile.name'] = userProject[0].userProfile.name
				}

				// Set the re-issue date and update the project details
				updateObject['$set']['certificate.reIssuedAt'] = new Date()
				await projectQueries.findOneAndUpdate(
					{
						_id: userProject[0]._id,
					},
					updateObject
				)

				// Resolve the promise with success message and project ID
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_SUBMITTED_FOR_REISSUE,
					data: {
						_id: userProject[0]._id,
					},
				})
			} catch (error) {
				// Resolve the promise with an error message
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Verify project certificate
	 * @method
	 * @name verifyCertificate
	 * @param {String} projectId - projectId.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {JSON} certificate details.
	 */

	static verifyCertificate(projectId, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				// Fetch project details based on projectId
				let projectDetails = await projectQueries.projectDocument({
					_id: projectId,
					tenantId: userDetails.userInformation.tenantId,
				})

				// Check if project details are not found
				if (!projectDetails || !projectDetails.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
					}
				}

				// Get the first element of project details array
				projectDetails = projectDetails[0]

				// Check if the project is not submitted or certificate is not eligible
				if (
					projectDetails.status !== CONSTANTS.common.SUBMITTED_STATUS ||
					!projectDetails.certificate ||
					!projectDetails.certificate.eligible
				) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_NOT_ELIGIBLE_FOR_CERTIFICATE,
					}
				}

				// Check if transaction ID is missing or empty
				if (!projectDetails.certificate.transactionId || projectDetails.certificate.transactionId === '') {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CERTIFICATE_NOT_AVAILABLE_FOR_THE_PROJECT,
					}
				}
				// Check if both PDF path and SVG path are missing or empty
				else if (
					!(projectDetails.certificate.pdfPath && projectDetails.certificate.pdfPath != '') &&
					!(projectDetails.certificate.svgPath && projectDetails.certificate.svgPath != '')
				) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CERTIFICATE_NOT_AVAILABLE_FOR_THE_PROJECT,
					}
				}

				let certificatePdfUrl, certificateSvgUrl
				const certificateUrls = await cloudServicesHelper.getDownloadableUrl([
					projectDetails.certificate.pdfPath ? projectDetails.certificate.pdfPath : '',
					projectDetails.certificate.svgPath ? projectDetails.certificate.svgPath : '',
				])
				if (certificateUrls && certificateUrls.result && certificateUrls.result.length > 0) {
					for (const certificateUrlsIndex of certificateUrls.result) {
						if (
							projectDetails.certificate.pdfPath != '' &&
							certificateUrlsIndex.filePath != '' &&
							certificateUrlsIndex.filePath == projectDetails.certificate.pdfPath
						) {
							certificatePdfUrl = certificateUrlsIndex.url
						} else if (
							projectDetails.certificate.svgPath != '' &&
							certificateUrlsIndex.filePath != '' &&
							certificateUrlsIndex.filePath == projectDetails.certificate.svgPath
						) {
							certificateSvgUrl = certificateUrlsIndex.url
						}
					}
				}

				// Prepare certificate verification information
				const certificateVerificationInfo = {
					projectId,
					projectName: projectDetails.title,
					programId: projectDetails.programId,
					solutionId: projectDetails.solutionId,
					solutionName: projectDetails.solutionInformation.name,
					userId: projectDetails.userProfile.id,
					userName: projectDetails.userProfile.name,
					status: projectDetails.certificate.status,
					isCertificateVerified: true,
					completedDate: projectDetails.completedDate,
					issuedOn: projectDetails.issuedOn,
					eligible: projectDetails.certificate.eligible,
					certificatePdfUrl: certificatePdfUrl ? certificatePdfUrl : '',
					certificateSvgUrl: certificateSvgUrl ? certificateSvgUrl : '',
				}

				// Resolve the promise with success response
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.CERTIFICATE_VERIFIED_SUCCESSFULLY,
					data: certificateVerificationInfo,
					result: certificateVerificationInfo,
				})
			} catch (error) {
				// Resolve the promise with error response
				return resolve({
					success: false,
					status: error.status,
					message: error.message,
				})
			}
		})
	}

	/**
	 * update project Information
	 * @method
	 * @name update
	 * @param {Object} filter - filter to search project to be updated.
	 * @param {Object} updateTo - data which will be updated.
	 * @param {String} userId - Logged in user Id.
	 * @param {String} userToken - filter to search project to be updated.
	 * @param {String} [appName = ""] - App Name.
	 * @param {String} [appVersion = ""] - App Version.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} status of update project
	 */

	static update(projectId, updateData, userId, appName = '', appVersion = '', userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				// if (updateData.taskId && updateData.noSyncCallBack) {
				// 	const progressStats = await this.updateTask(projectId, updateData.taskId, updateData)
				// 	return resolve({
				// 		success: true,
				// 		message: 'Task updated successfully',
				// 		result: progressStats,
				// 	})
				// }

				const userProject = await projectQueries.projectDocument(
					{
						_id: projectId,
						tenantId: userDetails.userInformation.tenantId,
					},
					['_id', 'reflection', 'tasks']
				)

				if (!(userProject.length > 0)) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
					}
				}
				if (updateData.tasks && updateData.tasks.length > 0) {
					updateData.tasks = _fillMissingTaskInformation(updateData.tasks, userProject[0].tasks)

					let allTasksFalttened = []
					for (let eachTask of updateData.tasks) {
						allTasksFalttened.push(eachTask)

						if (eachTask.children && eachTask.children.length > 0) {
							for (let eachChildTasks of eachTask.children) {
								allTasksFalttened.push(eachChildTasks)
							}
						}
					}

					validateAllTasks(allTasksFalttened)
				}

				let updateResult = await this.sync(
					projectId,
					'',
					updateData,
					userId,
					userDetails,
					appName,
					appVersion,
					true
				)
				const completeProject = await checkAndCompleteProject(projectId)
				const progress = await getTaskCompletionStats(projectId)
				if (process.env.ENABLE_PROGRAM_USER_MAPPING === 'true') {
					await this.updateProgramUserMapping(projectId)
				}

				if (updateResult.message == CONSTANTS.apiResponses.USER_PROJECT_UPDATED) {
					return resolve({
						message: CONSTANTS.apiResponses.USER_PROJECT_UPDATED,
						success: true,
						result: {
							_id: projectId,
							progress: progress,
						},
					})
				} else {
					throw {
						status: HTTP_STATUS_CODE.internal_server_error.status,
						message: updateResult.message || CONSTANTS.apiResponses.PROJECT_UPDATE_FAILED,
					}
				}
			} catch (error) {
				return resolve({
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					data: {},
				})
			}
		})
	}

	/**
   * deleteUserPIIData function to delete users Data.
   * @method
   * @name deleteUserPIIData
   * @param {userDeleteEvent} - userDeleteEvent message object
   * {
      	"entity": "user",
		"eventType": "delete",
		"entityId": 101,
		"changes": {},
		"created_by": 4,
		"organization_id": 22,
		"tenant_code": "shikshagraha",
		"status": "INACTIVE",
		"deleted": true,
		"id": 101,
		"username" : "user_shqwq1ssddw"
    }
   * @returns {Promise} success Data.
   */
	static deleteUserPIIData(userDeleteEvent) {
		return new Promise(async (resolve, reject) => {
			try {
				let userId = userDeleteEvent.id
				// Throw an error if userId is missing
				if (!userId) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_ID_MISSING,
					}
				}

				let userProfileConfig = defaultUserProfileConfig

				// Attempt to load configuration from the config JSON file if path is provided
				if (configFilePath) {
					const absolutePath = path.resolve(PROJECT_ROOT_DIRECTORY, configFilePath)
					if (fs.existsSync(absolutePath)) {
						const fileContent = fs.readFileSync(absolutePath)
						const parsed = JSON.parse(fileContent)

						if (
							parsed &&
							typeof parsed === CONSTANTS.common.OBJECT &&
							parsed.userProfileKeysForDelete &&
							typeof parsed.userProfileKeysForDelete === CONSTANTS.common.OBJECT
						) {
							userProfileConfig = parsed.userProfileKeysForDelete
						}
					}
				}

				let filter = {
					userId: userId,
				}

				// Get any specific masked values if defined, else fallback to default
				const specificValuesMap = userProfileConfig?.specificMaskedValues || {}
				const setOperations = {}

				// Prepare $set operations for fields to mask (anonymize)
				userProfileConfig.preserveAndMask.forEach((key) => {
					const maskValue = specificValuesMap[key] || userProfileConfig.defaultMaskedDataPlaceholder
					setOperations[`userProfile.${key}`] = maskValue
				})

				// Prepare $unset operations for fields to remove
				const unsetOperations = {}
				userProfileConfig.fieldsToRemove.forEach((key) => {
					unsetOperations[`userProfile.${key}`] = 1
				})

				// Combine $set and $unset operations
				const updateOperations = {
					$set: setOperations,
					$unset: unsetOperations,
				}

				// Update all matching records with the specified operations
				let result = await projectQueries.updateMany(filter, updateOperations)

				return resolve({
					success: true,
					message:
						result?.nModified > 0
							? CONSTANTS.apiResponses.DATA_DELETED_SUCCESSFULLY
							: CONSTANTS.apiResponses.FAILED_TO_DELETE_DATA,
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || error,
				})
			}
		})
	}
	/**
	 * Adds parent entity info to the project if an entityIdentifier exists in projectsInfo.
	 * @method
	 * @name attachEntityInformationIfExists
	 * @param {Object} projectsInfo - Project object with optional entity info.
	 * @returns {Promise<void>} - attaches parent entity information if it exists to projectsInfo variable
	 */
	static async attachEntityInformationIfExists(projectsInfo) {
		try {
			if (projectsInfo?.entityInformation?.externalId) {
				let entityInfoCall = await entitiesService.findEntityDetails(
					projectsInfo.tenantId,
					projectsInfo.entityInformation.externalId
				)
				if (entityInfoCall?.success && entityInfoCall.data?.length > 0) {
					projectsInfo.entityInformation.parentInformation = entityInfoCall.data[0].parentInformation
				}
			}
		} catch (err) {}
	}

	/**
	 * Create project plan from multiple templates.
	 * @method
	 * @name createProjectPlan
	 * @param {Object} data - request data.
	 * @param {String} userId - Logged in user id (admin).
	 * @param {String} userToken - User token.
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Object} Project Plan created information.
	 */
	static createProjectPlan(data, userId, userToken, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const { templates, userId: participantId, entityId, programName, projectConfig } = data
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId

				// Step 1: Validations
				// a. Validate Participant User
				let userProfile = await userService.profile(participantId, userToken)
				if (!userProfile.success || !userProfile.data) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_NOT_FOUND,
					}
				}

				// b. Validate Entity
				if (entityId) {
					let entityInformation = await entitiesService.entityDocuments(
						{ _id: entityId, tenantId: tenantId },
						CONSTANTS.common.ALL
					)
					if (!entityInformation?.success || !entityInformation?.data?.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.ENTITY_NOT_FOUND,
						}
					}
				}

				// c. Validate all Template IDs - must exist and be published
				// Filter out any templates without templateId
				const templateIds = templates
					.map((t) => (t && t.templateId ? t.templateId : null))
					.filter((id) => id !== null)

				if (templateIds.length === 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: 'No valid template IDs provided',
					}
				}

				const validTemplates = await projectTemplateQueries.templateDocument(
					{
						_id: { $in: templateIds },
						status: CONSTANTS.common.PUBLISHED,
						tenantId: tenantId,
					},
					['_id', 'title', 'categories', 'solutionId', 'solutionExternalId', 'externalId', 'taskSequence']
				)

				if (validTemplates.length !== templates.length) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
					}
				}

				// Collect all unique category IDs from templates
				let allCategoryIds = []
				const categoryIdSet = new Set() // To avoid duplicates
				validTemplates.forEach((template) => {
					if (template.categories && Array.isArray(template.categories)) {
						template.categories.forEach((category) => {
							const categoryId = category._id?.toString() || category
							if (categoryId && !categoryIdSet.has(categoryId)) {
								categoryIdSet.add(categoryId)
								allCategoryIds.push(categoryId)
							}
						})
					}
				})

				// Fetch full category documents from projectCategories collection
				let allCategories = []
				if (allCategoryIds.length > 0) {
					allCategories = await projectCategoriesQueries.categoryDocuments(
						{
							_id: { $in: allCategoryIds },
							tenantId: tenantId,
						},
						['_id', 'name', 'externalId', 'evidences']
					)
				}

				// Step 2: Always Create New Program & Solution
				let programAndSolutionData = {
					programName: programName || `Program for ${userProfile.data.name}`,
					isPrivateProgram: true,
					type: CONSTANTS.common.IMPROVEMENT_PROJECT,
					subType: CONSTANTS.common.IMPROVEMENT_PROJECT,
					isReusable: false,
					entities: entityId ? [entityId] : [],
				}

				let programAndSolutionInformation = await solutionsHelper.createProgramAndSolution(
					userId,
					programAndSolutionData,
					false,
					userDetails,
					true // isExternalProgram
				)

				if (!programAndSolutionInformation.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.SOLUTION_PROGRAMS_NOT_CREATED,
					}
				}

				const masterProgramId = programAndSolutionInformation.result.program._id
				const masterSolutionId = programAndSolutionInformation.result.solution._id

				let acl = {}
				if (userDetails.userInformation.userId != participantId) {
					acl = {
						visibility: CONSTANTS.common.PROJECT_VISIBILITY_SPECIFIC,
						users: [participantId, userDetails.userInformation.userId],
					}
				} else {
					acl = {
						visibility: CONSTANTS.common.PROJECT_VISIBILITY_SELF,
						users: [participantId],
					}
				}

				// Step 3: Initialize Single Project
				let projectData = {
					acl: acl,
					title: projectConfig?.name || `${userProfile.data.name}'s Project Plan`,
					description: projectConfig?.description || 'Individual Development Plan',
					userId: participantId,
					createdBy: userId,
					updatedBy: userId,
					status: CONSTANTS.common.STARTED,
					lastDownloadedAt: new Date(),
					isAPrivateProgram: true,
					programId: masterProgramId,
					programExternalId: programAndSolutionInformation.result.program.externalId,
					solutionId: masterSolutionId,
					solutionExternalId: programAndSolutionInformation.result.solution.externalId,
					programInformation: {
						_id: masterProgramId,
						name: programAndSolutionInformation.result.program.name,
						externalId: programAndSolutionInformation.result.program.externalId,
					},
					solutionInformation: {
						_id: masterSolutionId,
						name: programAndSolutionInformation.result.solution.name,
						externalId: programAndSolutionInformation.result.solution.externalId,
					},
					tenantId: tenantId,
					orgId: orgId,
					categories: allCategories, // Add categories from all templates
					keywords: ['project-plan'],
					referenceFrom: projectConfig?.referenceFrom || '',
					tasks: [],
					taskSequence: [],
					userProfile: userProfile.data,
					createdAt: new Date(),
					updatedAt: new Date(),
				}

				// Add project templates to project data
				projectData.projectTemplates = validTemplates.map((template) => ({
					_id: template._id instanceof global.ObjectId ? template._id : new global.ObjectId(template._id),
					externalId: template.externalId,
				}))

				// Add entity information if provided
				if (entityId) {
					const entityInfo = await entitiesService.entityDocuments(
						{ _id: entityId, tenantId: tenantId },
						CONSTANTS.common.ALL
					)
					if (entityInfo?.success && entityInfo?.data?.length > 0) {
						const entity = entityInfo.data[0]
						projectData.entityInformation = {
							_id: entity._id,
							entityType: entity.entityType,
							entityTypeId: entity.entityTypeId,
							entityId: entity._id,
							externalId: entity?.metaInformation?.externalId || '',
							entityName: entity?.metaInformation?.name || '',
						}
						projectData.entityId = entity._id
					}
				}

				// Step 4: Template Orchestration (Loop for each template)
				for (let templateIndex = 0; templateIndex < templates.length; templateIndex++) {
					const template = templates[templateIndex]

					// Validate template has templateId
					if (!template || !template.templateId) {
						continue
					}

					// a. Fetch Template metadata
					const templateData = validTemplates.find((t) => {
						if (!t || !t._id || !template.templateId) return false
						return t._id.toString() === template.templateId.toString()
					})

					if (!templateData) {
						continue // Skip invalid templates
					}

					// b. Create improvementProject task at root level first (to get its ID)
					const taskName =
						template.targetTaskName ||
						template.targetProjectName ||
						templateData.title ||
						`Template ${templateIndex + 1}`
					const taskExternalId = `task-${uuidv4().replace(/-/g, '')}`
					const improvementTaskId = uuidv4()

					// c. Fetch Template Tasks and Subtasks
					const templateTasks = await projectTemplatesHelper.tasksAndSubTasks(
						template.templateId,
						'', // language
						tenantId,
						orgId
					)

					if (!templateTasks || templateTasks.length === 0) {
						continue
					}

					let excludedExternalIds = []
					let filteredTemplateTasks = templateTasks
					if (
						template.excludedTaskIds &&
						Array.isArray(template.excludedTaskIds) &&
						template.excludedTaskIds.length > 0
					) {
						// Create a map for quick task lookup
						const templateTaskMap = new Map(templateTasks.map((task) => [task._id.toString(), task]))

						for (const taskId of template.excludedTaskIds) {
							const task = templateTaskMap.get(taskId.toString())
							if (!task) {
								throw {
									status: HTTP_STATUS_CODE.bad_request.status,
									message: `Task ID ${taskId} not found in template ${template.templateId}`,
								}
							}

							const isDeletable = task.hasOwnProperty('isDeletable') ? task.isDeletable : false
							if (!isDeletable) {
								throw {
									status: HTTP_STATUS_CODE.bad_request.status,
									message: `Task ${task.name} (${taskId}) is not deletable and cannot be excluded`,
								}
							}
							excludedExternalIds.push(task.externalId)
						}

						filteredTemplateTasks = templateTasks.filter(
							(task) => !template.excludedTaskIds.includes(task._id.toString())
						)
					}

					// Ensure all tasks have _id before processing (required by _projectTask)
					const tasksWithIds = filteredTemplateTasks
						.map((task) => {
							if (task && !task._id) {
								task._id = uuidv4()
							}
							return task
						})
						.filter((task) => task !== null && task !== undefined)

					// d. Process Template Tasks using _projectTask with improvementTaskId as parent
					let processedTemplateTasks = []
					try {
						processedTemplateTasks = await _projectTask(
							tasksWithIds,
							true, // isImportedFromLibrary
							improvementTaskId, // parentTaskId - set to improvementTask._id
							userToken,
							masterProgramId,
							userDetails
						)
					} catch (error) {
						console.error(`Error processing template tasks for template ${template.templateId}:`, error)
						throw error
					}

					// Ensure processedTemplateTasks is an array
					if (!Array.isArray(processedTemplateTasks)) {
						processedTemplateTasks = []
					}

					// e. Process Custom Tasks if provided
					let processedCustomTasks = []
					if (template.customTasks && template.customTasks.length > 0) {
						// Preserve metaInformation from original request before processing
						const originalMetaInformation = template.customTasks.map((task) => {
							return task && task.metaInformation ? { ...task.metaInformation } : null
						})

						// Ensure all custom tasks have _id before processing
						const customTasksWithIds = template.customTasks
							.map((task) => {
								if (task && !task._id) {
									task._id = uuidv4()
								}
								return task
							})
							.filter((task) => task !== null && task !== undefined)

						try {
							processedCustomTasks = await _projectTask(
								customTasksWithIds,
								false, // isImportedFromLibrary
								improvementTaskId, // parentTaskId - set to improvementTask._id
								userToken,
								masterProgramId,
								userDetails
							)
						} catch (error) {
							console.error(`Error processing custom tasks for template ${template.templateId}:`, error)
							throw error
						}

						// Ensure processedCustomTasks is an array
						if (!Array.isArray(processedCustomTasks)) {
							processedCustomTasks = []
						}

						// Mark all custom tasks as isACustomTask: true and add metaInformation
						processedCustomTasks.forEach((customTask, index) => {
							customTask.isACustomTask = true
							customTask.createdBy = userId
							customTask.updatedBy = userId
							customTask.createdAt = new Date()
							customTask.updatedAt = new Date()

							// Add metaInformation for custom tasks
							if (!customTask.metaInformation) {
								customTask.metaInformation = {}
							}

							// Use metaInformation from original request if present, else use defaults
							const originalMeta = originalMetaInformation[index]
							if (originalMeta) {
								// Merge original metaInformation with processed task's metaInformation
								customTask.metaInformation.buttonLabel =
									originalMeta.buttonLabel || customTask.metaInformation.buttonLabel || 'Upload'
								customTask.metaInformation.icon =
									originalMeta.icon || customTask.metaInformation.icon || 'Upload'
							} else {
								// No metaInformation in original request, use defaults
								customTask.metaInformation.buttonLabel =
									customTask.metaInformation.buttonLabel || 'Upload'
								customTask.metaInformation.icon = customTask.metaInformation.icon || 'Upload'
							}
						})
					}

					// f. Ensure parentId is set correctly for all root-level subtasks
					if (processedTemplateTasks && Array.isArray(processedTemplateTasks)) {
						processedTemplateTasks.forEach((task) => {
							if (task && (!task.parentId || task.parentId !== improvementTaskId)) {
								task.parentId = improvementTaskId
							}
						})
					}
					if (processedCustomTasks && Array.isArray(processedCustomTasks)) {
						processedCustomTasks.forEach((task) => {
							if (task && (!task.parentId || task.parentId !== improvementTaskId)) {
								task.parentId = improvementTaskId
							}
						})
					}

					// g. Combine template tasks and custom tasks as children
					const allSubTasks = [...processedTemplateTasks, ...processedCustomTasks]

					// h. Build taskSequence for improvementTask based on template's taskSequence
					let improvementTaskSequence = []

					// If template has taskSequence, use it to order the subtasks
					if (templateData.taskSequence && templateData.taskSequence.length > 0) {
						// Filter out excluded external IDs from template's taskSequence
						const filteredTemplateTaskSequence = templateData.taskSequence.filter(
							(extId) => !excludedExternalIds.includes(extId)
						)

						// Create a map of externalId to task for quick lookup
						const taskMap = new Map()
						allSubTasks.forEach((task) => {
							if (task && task.externalId) {
								taskMap.set(task.externalId, task)
							}
						})

						// First, add tasks in template's taskSequence order
						filteredTemplateTaskSequence.forEach((templateTaskExternalId) => {
							const task = taskMap.get(templateTaskExternalId)
							if (task && task.externalId) {
								improvementTaskSequence.push(task.externalId)
								taskMap.delete(templateTaskExternalId) // Remove to avoid duplicates
							}
						})

						// Then, add any remaining tasks (custom tasks or tasks not in template sequence)
						taskMap.forEach((task) => {
							if (task && task.externalId) {
								improvementTaskSequence.push(task.externalId)
							}
						})
					} else {
						// If no template taskSequence, use the order of processed tasks
						allSubTasks.forEach((subTask) => {
							if (subTask && subTask.externalId) {
								improvementTaskSequence.push(subTask.externalId)
							}
						})
					}

					let improvementTask = {
						_id: improvementTaskId,
						externalId: taskExternalId,
						name: taskName,
						description: template.targetTaskName || template.targetProjectName || templateData.title || '',
						type: CONSTANTS.common.IMPROVEMENT_PROJECT,
						status: CONSTANTS.common.NOT_STARTED_STATUS,
						isACustomTask: false,
						isDeletable: false,
						isDeleted: false,
						isImportedFromLibrary: false,
						createdAt: new Date(),
						updatedAt: new Date(),
						createdBy: userId,
						updatedBy: userId,
						tenantId: tenantId,
						orgId: orgId,
						syncedAt: new Date(),
						children: allSubTasks, // Template tasks + custom tasks as subtasks
						taskSequence: improvementTaskSequence, // Children's externalIds in correct order
						attachments: [],
						projectTemplateDetails: {
							_id: template.templateId,
							externalId: templateData && templateData.externalId ? templateData.externalId : '',
							name: templateData && templateData.title ? templateData.title : taskName,
						},
					}

					// Add improvementProject task to project
					// Root taskSequence should only contain improvementTask externalIds (not subtasks)
					projectData.tasks.push(improvementTask)
					projectData.taskSequence.push(taskExternalId)
				}

				// Step 5: Initialize task report for Project
				// Count all tasks (root level improvementProject tasks)
				const activeTasks = projectData.tasks.filter((t) => !t.isDeleted)
				let taskReport = {
					total: activeTasks.length,
				}

				activeTasks.forEach((task) => {
					if (task.isDeleted == false) {
						if (!taskReport[task.status]) {
							taskReport[task.status] = 1
						} else {
							taskReport[task.status] += 1
						}
					}
				})

				projectData.taskReport = taskReport
				// Step 6: Create Single Project
				// Ensure tasks array is properly initialized (should already be an array)
				if (!Array.isArray(projectData.tasks)) {
					projectData.tasks = []
				}

				let createdProject = await projectQueries.createProject(projectData)
				// Verify tasks were saved
				if (!createdProject.tasks || createdProject.tasks.length === 0) {
					console.error('WARNING: Project created but tasks array is empty!')
					console.error('Tasks that should have been saved:', projectData.tasks.length)
				}

				// Push to Kafka for event streaming
				await this.attachEntityInformationIfExists(createdProject)
				// let programUserMapping = await createProgramUserMapping({
				// 	userId: participantId,
				// 	project: createdProject,
				// })
				//console.log('Program User Mapping Result:*****************', programUserMapping)
				await kafkaProducersHelper.pushProjectToKafka(createdProject)
				await kafkaProducersHelper.pushUserActivitiesToKafka({
					userId: participantId,
					projects: createdProject,
				})

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_PLAN_CREATED,
					data: {
						projectId: createdProject._id,
					},
					result: {
						projectId: createdProject._id,
					},
				})
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || error,
				})
			}
		})
	}

	/**
	 * Get project  infromation when project as a task
	 * @method
	 * @name improvementProjectDetails
	 * @param {Object} projectData - Task data of project
	 * @param {Object} userRoleAndProfileInformation -
	 * @param {String} userToken - filter to search project to be updated.
	 * @param {String} userId - Logged in user Id.
	 * @param {Object} userDetails - to get user tenant and orgInfo
	 * @returns {Object} solutionDetails of  project
	 */
	static improvementProjectDetails(projectData, userRoleAndProfileInformation = {}, userToken, userId, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = {}
				userRoleAndProfileInformation.project = projectData.project

				if (projectData.projectTemplateDetails.isReusable) {
					let programAndSolutionData = {
						type: CONSTANTS.common.IMPROVEMENT_PROJECT,
						subType: CONSTANTS.common.IMPROVEMENT_PROJECT,
						isReusable: false,
						project: projectData.project,
					}
					if (projectData.programId !== '') {
						programAndSolutionData['programId'] = projectData.programId
					}
					let projectCreation = await this.importFromLibrary(
						projectData?.projectTemplateDetails?._id,
						programAndSolutionData,
						userToken,
						userId,
						false, // isAtargetedSolution
						'', //language
						userDetails
					)
					if (!projectCreation.success || !projectCreation?.data?._id) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.SOLUTION_PROGRAMS_NOT_CREATED,
						}
					}
					const { programId, _id, solutionId, solutionExternalId } = projectCreation.data

					//Adding solutionDetails for task
					let solutionDetails = {
						_id: solutionId,
						externalId: solutionExternalId,
						type: projectData?.projectTemplateDetails.type,
						isReusable: CONSTANTS.common.FALSE,
						minNoOfSubmissionsRequired: projectData?.projectTemplateDetails.minNoOfSubmissionsRequired
							? projectData?.projectTemplateDetails.minNoOfSubmissionsRequired
							: CONSTANTS.common.DEFAULT_SUBMISSION_REQUIRED,
					}

					let projectUpdated = await projectQueries.findOneAndUpdate(
						{
							_id: projectData.project._id,
							'tasks._id': projectData.project.taskId,
						},
						{
							$set: {
								solutionDetails: solutionDetails,
							},
						}
					)

					if (!projectUpdated._id) {
						throw {
							message: CONSTANTS.apiResponses.USER_PROJECT_NOT_UPDATED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					result['projectId'] = _id
					result['solutionId'] = solutionId
					result['programId'] = programId
					result['solutionDetails'] = solutionDetails
				} else {
					// create project using details function
					let projectDetails = await this.detailsV2(
						'', //projectId
						projectData.solutionDetails._id,
						userId,
						userToken,
						userRoleAndProfileInformation,
						'', //appName
						'', //appversion
						projectData.projectTemplateDetails.externalId,
						'', //language
						userDetails
					)
					//throw error if project not created
					if (!projectDetails.success || !projectDetails?.data?._id) {
						throw {
							message: CONSTANTS.apiResponses.PROJECT_NOT_CREATED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					result['projectId'] = projectDetails.data._id
					result['solutionId'] = projectData.solutionDetails._id
				}

				return resolve({
					success: true,
					data: result,
				})
			} catch (error) {
				return resolve({
					message: error.message,
					success: false,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				})
			}
		})
	}

	/**
	 * Update task status and attachments with cascading parent/project completion
	 * @param {String} projectId - Project ID
	 * @param {String} taskId - Task ID to update
	 * @param {Object} updateData - { status: 'completed', attachments: [...] }
	 */
	static async updateTask(projectId, taskId, updateData) {
		const { status, attachments } = updateData

		// Step 1: Find the project and determine if it's a direct task or child task
		let isAProjectPlan = false
		let project = await projectQueries.projectDocument(
			{
				_id: projectId,
				'tasks._id': taskId,
			},
			['tasks._id', 'tasks.status', 'tasks.children._id', 'tasks.children.status', 'status']
		)

		if (!project.length > 0) {
			project = await projectQueries.projectDocument(
				{
					_id: projectId,
					'tasks.children._id': taskId,
				},
				['tasks._id', 'tasks.status', 'tasks.children._id', 'tasks.children.status', 'status']
			)

			if (!project.length > 0) {
				throw {
					status: HTTP_STATUS_CODE.bad_request.status,
					message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
				}
			}
			isAProjectPlan = true
		}

		let parentTaskId = null

		// Step 2: Update the task
		if (!isAProjectPlan) {
			// Update direct task
			const updateFields = {
				'tasks.$.status': status,
				'tasks.$.updatedAt': new Date(),
			}

			if (attachments && attachments.length > 0) {
				updateFields['tasks.$.attachments'] = attachments
			}

			const projectUpdated = await projectQueries.findOneAndUpdate(
				{
					_id: projectId,
					'tasks._id': taskId,
				},
				{ $set: updateFields }
			)

			if (!projectUpdated._id) {
				throw {
					message: CONSTANTS.apiResponses.USER_PROJECT_NOT_UPDATED,
					status: HTTP_STATUS_CODE.internal_server_error.status,
				}
			}
		} else {
			// Update child task
			const parentTask = project[0].tasks.find((task) =>
				task.children?.some((childTask) => String(childTask._id) === String(taskId))
			)

			if (!parentTask) {
				throw {
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'Parent task not found',
				}
			}

			parentTaskId = parentTask._id

			const updateFields = {
				'tasks.$[task].children.$[child].status': status,
				'tasks.$[task].children.$[child].updatedAt': new Date(),
			}

			if (attachments && attachments.length > 0) {
				updateFields['tasks.$[task].children.$[child].attachments'] = attachments
			}

			await projectQueries.findOneAndUpdate(
				{ _id: projectId },
				{ $set: updateFields },
				{
					arrayFilters: [{ 'task._id': parentTaskId }, { 'child._id': taskId }],
				}
			)

			// Step 3: Check if all siblings are completed and mark parent as completed
			if (status === 'completed') {
				await checkAndCompleteParentTask(projectId, parentTaskId)
			}
		}

		// Step 4: Check if all parent tasks are completed and mark project as completed
		if (status === 'completed') {
			await checkAndCompleteProject(projectId)
		}

		const progressStats = await getTaskCompletionStats(projectId)

		// Step 5: Report task progress after update
		return {
			success: true,
			message: 'Task updated successfully',
			result: progressStats,
		}
	}
}

/**
 * Project information.
 * @method
 * @name _projectInformation
 * @param {Object} project - Project data.
 * @param {String} language - LanguageCode
 * @returns {Object} Project information.
 */

function _projectInformation(project, language) {
	return new Promise(async (resolve, reject) => {
		try {
			if (project.entityInformation) {
				project.entityId = project.entityInformation._id
				project.entityName = project.entityInformation.name
			} else if (project.solutionInformation && project.solutionInformation.entityType) {
				project['entityInformation'] = {
					entityType: project.solutionInformation.entityType,
				}
			}

			if (project.programInformation) {
				project.programId = project.programInformation._id
				project.programName = project.programInformation.name
			}

			//project attachments
			if (project.attachments && project.attachments.length > 0) {
				let projectLinkAttachments = []
				let projectAttachments = []

				for (
					let pointerToAttachment = 0;
					pointerToAttachment < project.attachments.length;
					pointerToAttachment++
				) {
					let currentProjectAttachment = project.attachments[pointerToAttachment]
					if (currentProjectAttachment.type == CONSTANTS.common.ATTACHMENT_TYPE_LINK) {
						projectLinkAttachments.push(currentProjectAttachment)
					} else {
						projectAttachments.push(currentProjectAttachment.sourcePath)
					}
				}
				let projectAttachmentsUrl = await _attachmentInformation(
					projectAttachments,
					projectLinkAttachments,
					project.attachments,
					CONSTANTS.common.PROJECT_ATTACHMENT
				)
				if (projectAttachmentsUrl.data && projectAttachmentsUrl.data.length > 0) {
					project.attachments = projectAttachmentsUrl.data
				}
			}

			//task attachments
			if (project.tasks && project.tasks.length > 0) {
				//order task based on task sequence
				if (project.taskSequence && project.taskSequence.length > 0) {
					project.tasks = taskArrayBySequence(project.tasks, project.taskSequence, 'externalId')
				}

				let attachments = []
				let mapTaskIdToAttachment = {}
				let mapLinkAttachment = {}

				for (let task = 0; task < project.tasks.length; task++) {
					// get translation data and modify actual data
					if (
						language !== '' &&
						project.tasks[task].translations &&
						project.tasks[task].translations[language]
					) {
						project.tasks[task] = UTILS.getTranslatedData(
							project.tasks[task],
							project.tasks[task].translations[language]
						)
					}
					//Once modified remove translations from response
					project.tasks[task] = _.omit(project.tasks[task], 'translations')
					let currentTask = project.tasks[task]

					if (currentTask.attachments && currentTask.attachments.length > 0) {
						for (let attachment = 0; attachment < currentTask.attachments.length; attachment++) {
							let currentAttachment = currentTask.attachments[attachment]

							if (currentAttachment.type == CONSTANTS.common.ATTACHMENT_TYPE_LINK) {
								if (
									!Array.isArray(mapLinkAttachment[currentTask._id]) ||
									!mapLinkAttachment[currentTask._id].length
								) {
									mapLinkAttachment[currentTask._id] = []
								}
								mapLinkAttachment[currentTask._id].push(currentAttachment)
							} else {
								attachments.push(currentAttachment.sourcePath)
							}

							if (
								!mapTaskIdToAttachment[currentAttachment.sourcePath] &&
								currentAttachment.type != CONSTANTS.common.ATTACHMENT_TYPE_LINK
							) {
								mapTaskIdToAttachment[currentAttachment.sourcePath] = {
									taskId: currentTask._id,
								}
							}
						}
					}

					if (currentTask.children && currentTask.children.length > 0) {
						for (let childTask = 0; childTask < currentTask.children.length; childTask++) {
							// get translation data and modify actual data
							if (
								language !== '' &&
								currentTask.children[childTask].translations &&
								currentTask.children[childTask].translations[language]
							) {
								currentTask.children[childTask] = UTILS.getTranslatedData(
									currentTask.children[childTask],
									currentTask.children[childTask].translations[language]
								)
							}
							//Once modified remove translations from response
							currentTask.children[childTask] = _.omit(currentTask.children[childTask], 'translations')
						}
					}
				}
				let taskAttachmentsUrl = await _attachmentInformation(
					attachments,
					mapLinkAttachment,
					[],
					CONSTANTS.common.TASK_ATTACHMENT,
					mapTaskIdToAttachment,
					project.tasks
				)
				if (taskAttachmentsUrl.data && taskAttachmentsUrl.data.length > 0) {
					project.tasks = taskAttachmentsUrl.data
				}
			}

			project.status = project.status ? project.status : CONSTANTS.common.NOT_STARTED_STATUS

			if (project.metaInformation) {
				Object.keys(project.metaInformation).forEach((projectMetaKey) => {
					project[projectMetaKey] = project.metaInformation[projectMetaKey]
				})
			}

			// capture reflectionEnabled info from solution and delete rest of the keys
			if (!project.solutionInformation) {
				project['solutionInformation'] = {
					reflectionEnabled: UTILS.convertStringToBoolean(process.env.ENABLE_REFLECTION),
				}
			} else {
				project['solutionInformation'] = {
					reflectionEnabled: project.solutionInformation.reflectionEnabled,
				}
			}

			delete project.metaInformation
			delete project.__v
			delete project.programInformation

			return resolve({
				success: true,
				data: project,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}

function taskArrayBySequence(taskArray, sequenceArray, key) {
	var map = sequenceArray.reduce((acc, value, index) => ((acc[value] = index + 1), acc), {})
	const sortedTaskArray = taskArray.sort((a, b) => (map[a[key]] || Infinity) - (map[b[key]] || Infinity))
	return sortedTaskArray
}

/**
 * Attachment information of project.
 * @method
 * @name _attachmentInformation
 * @param {Array} attachments - attachments data.
 * @param {String} type - project or task attachement.
 * @returns {Object} Project attachments.
 */
function _attachmentInformation(
	attachmentWithSourcePath = [],
	linkAttachments = [],
	attachments = [],
	type,
	mapTaskIdToAttachment = {},
	tasks = []
) {
	return new Promise(async (resolve, reject) => {
		try {
			let attachmentOrTask = []
			if (attachmentWithSourcePath && attachmentWithSourcePath.length > 0) {
				let attachmentsUrl = await cloudServicesHelper.getDownloadableUrl(attachmentWithSourcePath)
				if (!attachmentsUrl || !attachmentsUrl.result.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.ATTACHMENTS_URL_NOT_FOUND,
					}
				}

				if (attachmentsUrl.result && attachmentsUrl.result.length > 0) {
					if (type === CONSTANTS.common.PROJECT_ATTACHMENT) {
						attachmentsUrl.result.forEach((eachAttachment) => {
							let projectAttachmentIndex = attachments.findIndex(
								(attachmentData) => attachmentData.sourcePath == eachAttachment.filePath
							)

							if (projectAttachmentIndex > -1) {
								attachments[projectAttachmentIndex].url = eachAttachment.url
							}
						})
					} else {
						attachmentsUrl.result.forEach((taskAttachments) => {
							let taskIndex = tasks.findIndex(
								(task) => task._id === mapTaskIdToAttachment[taskAttachments.filePath].taskId
							)

							if (taskIndex > -1) {
								let attachmentIndex = tasks[taskIndex].attachments.findIndex(
									(attachment) => attachment.sourcePath === taskAttachments.filePath
								)

								if (attachmentIndex > -1) {
									tasks[taskIndex].attachments[attachmentIndex].url = taskAttachments.url
								}
							}
						})
					}
				}
			}

			if (linkAttachments && linkAttachments.length > 0) {
				if (type === CONSTANTS.common.PROJECT_ATTACHMENT) {
					attachments.concat(linkAttachments)
				} else {
					Object.keys(linkAttachments).forEach((eachTaskId) => {
						let taskIdIndex = tasks.findIndex((task) => task._id === eachTaskId)
						if (taskIdIndex > -1) {
							tasks[taskIdIndex].attachments.concat(linkAttachments[eachTaskId])
						}
					})
				}
			}

			attachmentOrTask = type === CONSTANTS.common.PROJECT_ATTACHMENT ? attachments : tasks

			return resolve({
				success: true,
				data: attachmentOrTask,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}

/**
 * Task of project.
 * @method
 * @name _projectTask
 * @param {Array} tasks - tasks data.
 * @param {String} userId - logged in user id.
 * @param {String} parentTaskId
 * @param {String} userToken-user auth token
 * @param {String}programId -ProgramId
 * @param {Object} userDetails - userinformation
 * @returns {Object} Project task.
 */

async function _projectTask(
	tasks,
	isImportedFromLibrary = false,
	parentTaskId = '',
	userToken,
	programId,
	userDetails
) {
	for (const singleTask of tasks) {
		if (singleTask) {
			singleTask.externalId = singleTask.externalId ? singleTask.externalId : singleTask.name.toLowerCase()
			singleTask.type = singleTask.type ? singleTask.type : CONSTANTS.common.SIMPLE_TASK_TYPE
			singleTask.status = singleTask.status ? singleTask.status : CONSTANTS.common.NOT_STARTED_STATUS
			singleTask.isDeleted = singleTask.isDeleted ? singleTask.isDeleted : false
			singleTask.attachments = singleTask.attachments ? singleTask.attachments : []
			if (!singleTask.hasOwnProperty('isDeletable')) {
				singleTask.isDeletable = true
			}
			if (UTILS.isValidMongoId(singleTask._id.toString())) {
				if (
					[CONSTANTS.common.OBSERVATION, CONSTANTS.common.SURVEY, CONSTANTS.common.PROJECT].includes(
						singleTask.type
					)
				)
					singleTask.referenceId = singleTask.solutionDetails.parentTaskId
				else singleTask.referenceId = singleTask._id.toString()
			}
			singleTask.createdAt = singleTask.createdAt ? singleTask.createdAt : new Date()
			singleTask.updatedAt = new Date()
			singleTask._id = UTILS.isValidMongoId(singleTask._id.toString()) ? uuidv4() : singleTask._id
			singleTask.isImportedFromLibrary = isImportedFromLibrary
			singleTask.syncedAt = new Date()

			if (singleTask.startDate) {
				singleTask.startDate = singleTask.startDate
			}

			if (singleTask.endDate) {
				singleTask.endDate = singleTask.endDate
			}

			if (singleTask.visibleIf && singleTask.visibleIf.length > 0) {
				if (parentTaskId !== '') {
					singleTask.visibleIf.forEach((task) => {
						task._id = parentTaskId
					})
				}
			}
			let importSolutionsResponse
			// create a child solution if solutionDetails has isReusable true solution details
			if (singleTask?.solutionDetails?.isReusable) {
				let programInformation = await programQueries.programsDocument({
					_id: programId,
					tenantId: userDetails.userInformation.tenantId,
				})

				programInformation = programInformation[0]

				let componentLength = programInformation?.components?.length || 0
				userDetails.tenantAndOrgInfo = {
					tenantId: userDetails.userInformation.tenantId,
					orgId: [userDetails.userInformation.organizationId],
				}
				if (singleTask.solutionDetails.type === CONSTANTS.common.OBSERVATION) {
					const timestamp = UTILS.epochTime()
					// Creating child observation solution
					importSolutionsResponse = await surveyService.importTemplateToSolution(
						userToken,
						singleTask.solutionDetails._id,
						'',
						{
							name: `${singleTask.solutionDetails.name}`,
							externalId: `${singleTask.solutionDetails.externalId}-${timestamp}`,
							description: `${singleTask.solutionDetails.name}`,
							programExternalId: programId,
							status: CONSTANTS.common.PUBLISHED_STATUS,
							tenantData: userDetails.tenantAndOrgInfo,
							userId: userDetails.userInformation.userId,
						},
						userDetails,
						singleTask.solutionDetails.type
					)

					if (
						importSolutionsResponse.status != HTTP_STATUS_CODE['ok'].status ||
						!importSolutionsResponse?.data?.externalId
					) {
						throw {
							message: CONSTANTS.apiResponses.SOLUTION_NOT_CREATED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					// Assinging the new solution  values to task solutionDetails
					singleTask.solutionDetails._id = importSolutionsResponse.result._id
					singleTask.solutionDetails.externalId = importSolutionsResponse.result.externalId
					singleTask.solutionDetails.isReusable = CONSTANTS.common.FALSE

					//updating programComponents
					await programsQueries.findAndUpdate(
						{
							_id: programId,
						},
						{
							$addToSet: {
								components: {
									_id: ObjectId(importSolutionsResponse.result._id),
									order: ++componentLength,
								},
							},
						}
					)
				} else if (singleTask.solutionDetails.type === CONSTANTS.common.SURVEY) {
					// Creating child survey solution
					importSolutionsResponse = await surveyService.importTemplateToSolution(
						userToken,
						singleTask.solutionDetails._id,
						programId,
						{
							tenantData: userDetails.tenantAndOrgInfo,
							userId: userDetails.userInformation.userId,
						},
						userDetails,
						singleTask.solutionDetails.type
					)

					if (
						importSolutionsResponse.status != HTTP_STATUS_CODE['ok'].status ||
						!importSolutionsResponse?.result?.solutionExternalId
					) {
						throw {
							message: CONSTANTS.apiResponses.SOLUTION_NOT_CREATED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					singleTask.solutionDetails._id = importSolutionsResponse.result.solutionId
					singleTask.solutionDetails.externalId = importSolutionsResponse.result.solutionExternalId
					singleTask.solutionDetails.isReusable = CONSTANTS.common.FALSE
					//updating programComponents
					await programsQueries.findAndUpdate(
						{
							_id: programId,
						},
						{
							$addToSet: {
								components: {
									_id: ObjectId(importSolutionsResponse.result.solutionId),
									order: ++componentLength,
								},
							},
						}
					)
				}
			}
			removeFieldsFromRequest.forEach((removeField) => {
				delete singleTask[removeField]
			})

			if (singleTask.children) {
				await _projectTask(
					singleTask.children,
					isImportedFromLibrary,
					singleTask._id,
					userToken,
					programId,
					userDetails
				)
			} else {
				singleTask.children = []
			}
		}
	}

	return tasks
}
/**
 * Validates that all tasks in the provided array contain required fields.
 * @function
 * @name validateAllTasks
 * @param {Array} tasks - Array of task objects to be validated.
 * @throws {Error} If any task is missing the required `_id` or `name` fields.
 * @returns {void} - This function does not return a value; it throws an error if validation fails.
 */

function validateAllTasks(tasks) {
	for (let eachTask of tasks) {
		if (!eachTask._id || !eachTask.name) {
			throw new Error(CONSTANTS.apiResponses.REQUIRED_FIELDS_NOT_PRESENT_FOR_THE_TASK_UPDATE)
		}

		if (
			eachTask.status &&
			![
				CONSTANTS.common.COMPLETED_STATUS,
				CONSTANTS.common.INPROGRESS_STATUS,
				CONSTANTS.common.NOT_STARTED_STATUS,
				CONSTANTS.common.STARTED,
			].includes(eachTask.status)
		) {
			throw new Error(CONSTANTS.apiResponses.INVALID_TASK_STATUS)
		}
	}
}

/**
 * Fill missing information in tasks from database.
 * @method
 * @name _fillMissingTaskInformation
 * @param {Array} tasks - Tasks with potentially missing information.
 * @param {Array} tasksFromDB - Tasks data retrieved from the database.
 * @returns {Array} Updated tasks with missing information filled.
 */
function _fillMissingTaskInformation(tasks, tasksFromDB) {
	// Main loop to go through all tasks and fill missing properties
	for (let eachTask of tasks) {
		let targetTask = tasksFromDB.find((singleTask) => singleTask._id == eachTask._id)
		if (targetTask) {
			fillMissingProperties(eachTask, targetTask)
		}
	}

	return tasks
}

/**
 * Recursively fills missing properties in eachTask using the values from targetTask.
 * @param {Object} eachTask - The task object that may have missing properties.
 * @param {Object} targetTask - The task object from the database, used to fill missing properties.
 * @returns {void} This function does not return a value. It modifies eachTask in place.
 */
function fillMissingProperties(eachTask, targetTask) {
	const dateSpecificFields = ['createdAt', 'updatedAt', 'syncedAt']
	for (let key in targetTask) {
		if (Array.isArray(targetTask[key])) {
			if (!eachTask[key] || eachTask[key].length === 0) {
				// If the array is missing or empty, copy the entire array from the targetTask
				eachTask[key] = [...targetTask[key]]
			} else {
				// Merge the two arrays: existing data from DB and incoming updates
				const updatedArray = []

				// Map over the incoming array (eachTask[key]) to fill missing properties
				eachTask[key].forEach((item) => {
					const targetItem = targetTask[key].find((dbItem) => dbItem._id === item._id) || {}
					const updatedItem = { ...targetItem, ...item } // Merge incoming and existing data
					fillMissingProperties(updatedItem, targetItem)
					updatedArray.push(updatedItem)
				})

				// Add remaining items from the DB that are not in the incoming array
				const remainingItems = targetTask[key].filter(
					(dbItem) => !eachTask[key].some((item) => item._id === dbItem._id)
				)

				eachTask[key] = [...updatedArray, ...remainingItems]
			}
		} else if (typeof targetTask[key] === 'object' && targetTask[key] !== null) {
			// If the property is an object (excluding null), call the function recursively
			if (!eachTask[key]) {
				// Update the date specific fields
				if (dateSpecificFields.includes(key)) {
					if (key == 'createdAt') {
						eachTask[key] = targetTask[key] ? targetTask[key] : new Date()
					} else if (key == 'updatedAt' || key == 'syncedAt') {
						eachTask[key] = new Date()
					}
				} else {
					eachTask[key] = targetTask[key] ? targetTask[key] : {} // Initialize the object if it's missing
				}
			}
		} else {
			// If the property is a primitive value, just fill in missing values
			if (!eachTask[key]) {
				eachTask[key] = targetTask[key]
			}
		}
	}
}
/**
 * Project categories information.
 * @method
 * @name _projectCategories
 * @param {Array} categories - Categories data.
 * @param {String} tenantId - user's tenant id
 * @param {String} orgId - user's org id
 * @returns {Object} Project categories information.
 */

function _projectCategories(categories, tenantId, orgId) {
	return new Promise(async (resolve, reject) => {
		try {
			let categoryIds = []

			categories.forEach((category) => {
				if (category._id && category._id !== '') {
					categoryIds.push(category._id)
				}
			})

			let categoryData = []

			if (categoryIds.length > 0) {
				categoryData = await projectCategoriesQueries.categoryDocuments(
					{
						_id: { $in: categoryIds },
						tenantId: tenantId,
					},
					['name', 'externalId']
				)

				if (!categoryData.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CATEGORY_NOT_FOUND,
					}
				}
			}

			let categoryInternalIdToData = {}

			if (categoryData.length > 0) {
				categoryData.forEach((category) => {
					categoryInternalIdToData[category._id.toString()] = category
				})
			}

			const categoriesData = categories.map((category) => {
				let categoryData = {}

				if (category._id && category._id !== '' && categoryInternalIdToData[category._id]) {
					categoryData = categoryInternalIdToData[category._id]
				} else {
					categoryData = {
						name: category.label,
						externalId: '',
						_id: '',
					}
				}

				return categoryData
			})

			return resolve({
				success: true,
				data: categoriesData,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				success: false,
				data: {},
			})
		}
	})
}

/**
 * Entities information for project.
 * @method
 * @name _entitiesInformation
 * @param {String} entityIds - entity id.
 * @returns {Object} Project entity information.
 */

// This function is currently not being used in EP

// function _entitiesInformation(entityIds) {
// 	return new Promise(async (resolve, reject) => {
// 		try {
// 			let locationIds = []
// 			let locationCodes = []
// 			let entityInformations = []
// 			entityIds.forEach((entity) => {
// 				if (UTILS.checkValidUUID(entity)) {
// 					locationIds.push(entity)
// 				} else {
// 					locationCodes.push(entity)
// 				}
// 			})

// 			if (locationIds.length > 0) {
// 				let queryData = {
// 					'registryDetails.locationId': { $in: locationIds },
// 					_id: { $in: locationIds },
// 				}
// 				let entityData = await entitiesService.entityDocuments(queryData, 'all')
// 				if (entityData.success) {
// 					entityInformations = entityData.data
// 				}
// 			}

// 			// if ( locationCodes.length > 0 ) {
// 			//     let bodyData = {
// 			//         "code" : locationCodes
// 			//     }
// 			//     let entityData = await userService.locationSearch( bodyData , formatResult = true );
// 			//     if ( entityData.success ) {
// 			//         entityInformations =  entityInformations.concat(entityData.data);
// 			//     }
// 			// }

// 			// above code is commented as we are already fetching entity related info from entitiesService

// 			if (!entityInformations.length > 0) {
// 				throw {
// 					status: HTTP_STATUS_CODE.bad_request.status,
// 					message: CONSTANTS.apiResponses.ENTITY_NOT_FOUND,
// 				}
// 			}

// 			// below code is commented as we are already fetching entity related info from entitiesService
// 			// let entitiesData = [];
// 			// if ( entityInformations.length > 0 ) {
// 			//     entitiesData = await _entitiesMetaInformation(entityInformations);
// 			// }

// 			return resolve({
// 				success: true,
// 				data: entityInformations,
// 			})
// 		} catch (error) {
// 			return resolve({
// 				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
// 				success: false,
// 				message: error.message,
// 				data: [],
// 			})
// 		}
// 	})
// }

/**
 * Assessment details
 * @method
 * @name _assessmentDetails
 * @param {Object} assessmentData - Assessment data.
 * @returns {Object}
 */

function _assessmentDetails(assessmentData) {
	return new Promise(async (resolve, reject) => {
		try {
			let result = {}

			if (assessmentData.project) {
				let templateTasks = await projectTemplateTaskQueries.taskDocuments(
					{
						externalId: assessmentData.project.taskId,
					},
					['_id']
				)

				if (templateTasks.length > 0) {
					assessmentData.project.taskId = templateTasks[0]._id
				}
			}

			if (assessmentData.solutionDetails.isReusable) {
				let createdAssessment = await surveyService.createAssessmentSolutionFromTemplate(
					assessmentData.token,
					assessmentData.solutionDetails._id,
					{
						name: assessmentData.solutionDetails.name + '-' + UTILS.epochTime(),
						description: assessmentData.solutionDetails.name + '-' + UTILS.epochTime(),
						program: {
							_id: assessmentData.programId,
							name: '',
						},
						entities: [assessmentData.entityId],
						project: assessmentData.project,
					}
				)

				if (!createdAssessment.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.COULD_NOT_CREATE_ASSESSMENT_SOLUTION,
					}
				}

				result['solutionId'] = createdAssessment.data._id
			} else {
				let assignedAssessmentToUser = await surveyService.createEntityAssessors(
					assessmentData.token,
					assessmentData.solutionDetails.programId,
					assessmentData.solutionDetails._id,
					[assessmentData.entityId]
				)

				if (!assignedAssessmentToUser.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.FAILED_TO_ASSIGNED_ASSESSMENT_TO_USER,
					}
				}

				let entitiesAddedToSolution = await surveyService.addEntitiesToSolution(
					assessmentData.token,
					assessmentData.solutionDetails._id,
					[assessmentData.entityId.toString()]
				)

				if (!entitiesAddedToSolution.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.FAILED_TO_ADD_ENTITY_TO_SOLUTION,
					}
				}

				let solutionUpdated = await surveyService.updateSolution(
					assessmentData.token,
					{
						project: assessmentData.project,
						referenceFrom: 'project',
					},
					assessmentData.solutionDetails.externalId
				)

				if (!solutionUpdated.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.SOLUTION_NOT_UPDATED,
					}
				}

				result['solutionId'] = assessmentData.solutionDetails._id
			}

			return resolve({
				success: true,
				data: result,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}

/**
 * Observation details
 * @method
 * @name _observationDetails
 * @param {Object} observationData - Observation data.
 * @param {Object} userRoleAndProfileInformation -req body Data
 * @returns {Object}
 */

function _observationDetails(observationData, userRoleAndProfileInformation = {}) {
	return new Promise(async (resolve, reject) => {
		try {
			let result = {}

			if (observationData.project) {
				let templateTasks = await projectTemplateTaskQueries.taskDocuments(
					{
						externalId: observationData.project.taskId,
					},
					['_id']
				)

				if (templateTasks.length > 0) {
					observationData.project.taskId = templateTasks[0]._id
				}
			}
			let startDate = new Date()
			let endDate = new Date()
			endDate.setFullYear(endDate.getFullYear() + 1)
			let observationPayload = {
				name: observationData.solutionDetails.name,
				description: observationData.solutionDetails.name,
				status: CONSTANTS.common.PUBLISHED_STATUS,
				startDate: startDate,
				endDate: endDate,
				...((observationData.entityId ||
					userRoleAndProfileInformation[observationData.solutionDetails.subType]) && {
					entities: [
						observationData.entityId ||
							userRoleAndProfileInformation[observationData.solutionDetails.subType],
					],
				}),

				project: observationData.project,
			}
			let observationCreated = await surveyService.createObservation(
				observationData.token,
				observationData.solutionDetails._id,
				observationPayload,
				userRoleAndProfileInformation && Object.keys(userRoleAndProfileInformation).length > 0
					? userRoleAndProfileInformation
					: {},
				observationData.programId
			)
			if (!observationCreated.success || !observationCreated?.data?._id) {
				throw {
					status: HTTP_STATUS_CODE.bad_request.status,
					message: observationCreated.message || CONSTANTS.apiResponses.OBSERVATION_NOT_CREATED,
				}
			} else {
				result['observationId'] = observationCreated.data._id
			}

			result['solutionId'] = observationData.solutionDetails._id

			return resolve({
				success: true,
				data: result,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}
/**
 * Survey details
 * @method
 * @name _surveyDetails
 * @param {Object} surveyData - survey data.
 * @param {Object} userRoleAndProfileInformation -req body Data
 * @returns {Object}
 */
function _surveyDetails(surveyData, userRoleAndProfileInformation = {}) {
	return new Promise(async (resolve, reject) => {
		try {
			let result = {}
			if (surveyData.project) {
				let templateTasks = await projectTemplateTaskQueries.taskDocuments(
					{
						externalId: surveyData.project.taskId,
					},
					['_id']
				)

				if (templateTasks.length > 0) {
					surveyData.project.taskId = templateTasks[0]._id
				}
			}
			let surveyCreated
			userRoleAndProfileInformation['project'] = surveyData.project
			// create survey using details api
			surveyCreated = await surveyService.surveyDetails(
				surveyData.token,
				surveyData.solutionDetails._id,
				userRoleAndProfileInformation
			)
			if (!surveyCreated.success || !surveyCreated?.data?.assessment?.submissionId) {
				throw {
					status: HTTP_STATUS_CODE.bad_request.status,
					message: CONSTANTS.apiResponses.SURVEY_NOT_CREATED,
				}
			}
			result['surveySubmissionId'] = surveyCreated.data.assessment.submissionId
			result['solutionId'] = surveyData.solutionDetails._id

			return resolve({
				success: true,
				data: result,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}

/**
 * Observation details
 * @method
 * @name _entitiesMetaInformation
 * @param {Object} entitiesData - entities data.
 * @returns {Object} - entities metadata.
 */

function _entitiesMetaInformation(entitiesData) {
	return new Promise(async (resolve, reject) => {
		let entityInformation = []
		for (let index = 0; index < entitiesData.length; index++) {
			let entityHierarchy = await userService.getParentEntities(entitiesData[index]._id)
			entitiesData[index].metaInformation.hierarchy = entityHierarchy
			entitiesData[index].metaInformation._id = entitiesData[index]._id
			entitiesData[index].metaInformation.entityType = entitiesData[index].entityType
			entitiesData[index].metaInformation.registryDetails = entitiesData[index].registryDetails
			entityInformation.push(entitiesData[index].metaInformation)
		}

		return resolve(entityInformation)
	})
}

/**
 * Project Add And Sync Common information.
 * @method
 * @name _projectData
 * @param {Array} data - Req data.
 * @param {String} tenantId - user's tenant id
 * @param {String} orgId - user's org id
 * @returns {Object} Project Add information.
 */

function _projectData(data, tenantId, orgId) {
	return new Promise(async (resolve, reject) => {
		try {
			let projectData = {}
			if (data.categories && data.categories.length > 0) {
				let categories = await _projectCategories(data.categories, tenantId, orgId)

				if (!categories.success) {
					return resolve(categories)
				}

				projectData.categories = categories.data
			}

			if (data.startDate) {
				projectData['startDate'] = data.startDate
			}

			if (data.endDate) {
				projectData['endDate'] = data.endDate
			}

			if (data.learningResources) {
				projectData.learningResources = data.learningResources
			}

			projectData.syncedAt = new Date()

			return resolve({
				success: true,
				data: projectData,
			})
		} catch (error) {
			return resolve({
				message: error.message,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				success: false,
				data: {},
			})
		}
	})
}

/**
 * Validate & Update UserProfile in Projects.
 * @method
 * @name _updateUserProfileBasedOnUserRoleInfo
 * @param {Object} userProfile - userProfile data.
 * @param {Object} userRoleInformation - userRoleInformation data.
 * @returns {Object} updated UserProfile information.
 */

function _updateUserProfileBasedOnUserRoleInfo(userProfile, userRoleInformation) {
	return new Promise(async (resolve, reject) => {
		try {
			let updateUserProfileRoleInformation = false // Flag to see if roleInformation i.e. userProfile.profileUserTypes has to be updated based on userRoleInfromation.roles

			if (userRoleInformation.role) {
				// Check if userRoleInformation has role value.
				let rolesInUserRoleInformation = userRoleInformation.role.split(',') // userRoleInfomration.role can be multiple with comma separated.

				let resetCurrentUserProfileRoles = false // Flag to reset current userProfile.profileUserTypes i.e. if current role in profile is not at all there in userRoleInformation.roles
				// Check if userProfile.profileUserTypes exists and is an array of length > 0
				if (
					userProfile.profileUserTypes &&
					Array.isArray(userProfile.profileUserTypes) &&
					userProfile.profileUserTypes.length > 0
				) {
					// Loop through current roles in userProfile.profileUserTypes
					for (
						let pointerToCurrentProfileUserTypes = 0;
						pointerToCurrentProfileUserTypes < userProfile.profileUserTypes.length;
						pointerToCurrentProfileUserTypes++
					) {
						const currentProfileUserType = userProfile.profileUserTypes[pointerToCurrentProfileUserTypes]

						if (currentProfileUserType.subType && currentProfileUserType.subType !== null) {
							// If the role has a subType

							// Check if subType exists in userRoleInformation role, if not means profile data is old and should be reset.
							if (
								!userRoleInformation.role
									.toUpperCase()
									.includes(currentProfileUserType.subType.toUpperCase())
							) {
								resetCurrentUserProfileRoles = true // Reset userProfile.profileUserTypes
								break
							}
						} else {
							// If the role subType is null or is not there

							// Check if type exists in userRoleInformation role, if not means profile data is old and should be reset.
							if (
								!userRoleInformation.role
									.toUpperCase()
									.includes(currentProfileUserType.type.toUpperCase())
							) {
								resetCurrentUserProfileRoles = true // Reset userProfile.profileUserTypes
								break
							}
						}
					}
				}
				if (resetCurrentUserProfileRoles) {
					// Reset userProfile.profileUserTypes
					userProfile.profileUserTypes = new Array()
				}

				// Loop through each subRole in userRoleInformation
				for (
					let pointerToRolesInUserInformation = 0;
					pointerToRolesInUserInformation < rolesInUserRoleInformation.length;
					pointerToRolesInUserInformation++
				) {
					const subRole = rolesInUserRoleInformation[pointerToRolesInUserInformation]
					// Check if userProfile.profileUserTypes exists and is an array of length > 0
					if (
						userProfile.profileUserTypes &&
						Array.isArray(userProfile.profileUserTypes) &&
						userProfile.profileUserTypes.length > 0
					) {
						if (
							!_.find(userProfile.profileUserTypes, { type: subRole.toLowerCase() }) &&
							!_.find(userProfile.profileUserTypes, { subType: subRole.toLowerCase() })
						) {
							updateUserProfileRoleInformation = true // Need to update userProfile.profileUserTypes
							if (subRole.toUpperCase() === 'TEACHER') {
								// If subRole is not teacher
								userProfile.profileUserTypes.push({
									subType: null,
									type: 'teacher',
								})
							} else {
								// If subRole is not teacher
								userProfile.profileUserTypes.push({
									subType: subRole.toLowerCase(),
									type: 'administrator',
								})
							}
						}
					} else {
						// Make a new entry if userProfile.profileUserTypes is empty or does not exist.
						updateUserProfileRoleInformation = true // Need to update userProfile.profileUserTypes
						userProfile.profileUserTypes = new Array()
						if (subRole.toUpperCase() === 'TEACHER') {
							// If subRole is teacher
							userProfile.profileUserTypes.push({
								subType: null,
								type: 'teacher',
							})
						} else {
							// If subRole is not teacher
							userProfile.profileUserTypes.push({
								subType: subRole.toLowerCase(),
								type: 'administrator',
							})
						}
					}
				}
			}

			if (updateUserProfileRoleInformation) {
				// If profileUserTypes in userProfile was wrong and is updated as per userRoleInformation
				userProfile.userRoleMismatchFoundAndUpdated = true
			}

			// Create location only object from userRoleInformation
			let userRoleInformationLocationObject = _.omit(userRoleInformation, ['role'])

			// All location keys from userRoleInformation
			let userRoleInfomrationLocationKeys = Object.keys(userRoleInformationLocationObject)

			let updateUserProfileLocationInformation = false // Flag to see if userLocations i.e. userProfile.userLocations has to be updated based on userRoleInfromation location values

			// Loop through all location keys.
			for (
				let pointerToUserRoleInfromationLocationKeys = 0;
				pointerToUserRoleInfromationLocationKeys < userRoleInfomrationLocationKeys.length;
				pointerToUserRoleInfromationLocationKeys++
			) {
				const locationType = userRoleInfomrationLocationKeys[pointerToUserRoleInfromationLocationKeys] // e.g. state, district, school
				const locationValue = userRoleInformationLocationObject[locationType] // Location UUID values or school code.

				// Check if userProfile.userLocations exists and is an array of length > 0
				if (
					userProfile.userLocations &&
					Array.isArray(userProfile.userLocations) &&
					userProfile.userLocations.length > 0
				) {
					if (locationType === 'school') {
						// If location type school exist check if same is there in userProfile.userLocations
						if (!_.find(userProfile.userLocations, { type: 'school', code: locationValue })) {
							updateUserProfileLocationInformation = true // School does not exist in userProfile.userLocations, update entire userProfile.userLocations
							break
						}
					} else {
						// Check if location type is there in userProfile.userLocations and has same value as userRoleInformation
						if (!_.find(userProfile.userLocations, { type: locationType, id: locationValue })) {
							updateUserProfileLocationInformation = true // Location does not exist in userProfile.userLocations, update entire userProfile.userLocations
							break
						}
					}
				} else {
					updateUserProfileLocationInformation = true
					break
				}
			}

			if (
				userProfile.userLocations &&
				Array.isArray(userProfile.userLocations) &&
				userProfile.userLocations.length > 0
			) {
				if (userProfile.userLocations.length != userRoleInfomrationLocationKeys.length) {
					updateUserProfileLocationInformation = true
				}
			}

			// If userProfile.userLocations has to be updated, get all values and set in userProfile.
			if (updateUserProfileLocationInformation) {
				//update userLocations in userProfile
				let locationIds = []
				let locationCodes = []
				let userLocations = new Array()

				userRoleInfomrationLocationKeys.forEach((requestedDataKey) => {
					if (UTILS.checkValidUUID(userRoleInformationLocationObject[requestedDataKey])) {
						locationIds.push(userRoleInformationLocationObject[requestedDataKey])
					} else {
						locationCodes.push(userRoleInformationLocationObject[requestedDataKey])
					}
				})

				//query for fetch location using id
				if (locationIds.length > 0) {
					let locationQuery = {
						id: locationIds,
					}

					let entityData = await userService.locationSearch(locationQuery)
					if (entityData.success) {
						userLocations = entityData.data
					}
				}

				// query for fetch location using code
				if (locationCodes.length > 0) {
					let codeQuery = {
						code: locationCodes,
					}

					let entityData = await userService.locationSearch(codeQuery)
					if (entityData.success) {
						userLocations = userLocations.concat(entityData.data)
					}
				}

				if (userLocations.length > 0) {
					userProfile['userLocations'] = userLocations
					userProfile.userLocationsMismatchFoundAndUpdated = true // If userLocations in userProfile was wrong and is updated as per userRoleInformation
				}
			}

			return resolve({
				success: true,
				profileMismatchFound:
					updateUserProfileLocationInformation || updateUserProfileRoleInformation ? true : false,
				data: userProfile,
			})
		} catch (error) {
			return resolve({
				status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
				message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				data: false,
			})
		}
	})
}

/**
 * Calculate and return task completion statistics with individual task breakdown
 * @param {String} projectId - Project ID
 * @returns {Object} - Overall stats + individual task progress
 */
async function getTaskCompletionStats(projectId) {
	const project = await projectQueries.projectDocument({ _id: projectId }, [
		'tasks._id',
		'tasks.name',
		'tasks.status',
		'tasks.children._id',
		'tasks.children.status',
		'status',
	])

	if (!project.length > 0) {
		throw {
			status: HTTP_STATUS_CODE.bad_request.status,
			message: CONSTANTS.apiResponses.USER_PROJECT_NOT_FOUND,
		}
	}

	let totalTasks = 0
	let completedTasks = 0
	const taskProgress = {} // Individual task progress

	project[0].tasks.forEach((task) => {
		const taskId = String(task._id)

		if (task.children && task.children.length > 0) {
			// Parent task with children - track children progress
			let taskTotalChildren = 0
			let taskCompletedChildren = 0

			task.children.forEach((child) => {
				taskTotalChildren++
				totalTasks++

				if (child.status === 'completed') {
					taskCompletedChildren++
					completedTasks++
				}
			})

			// Calculate completion percentage for this parent task
			const taskCompletionPercentage =
				taskTotalChildren > 0 ? ((taskCompletedChildren / taskTotalChildren) * 100).toFixed(2) : 0

			// Store individual task progress
			taskProgress[taskId] = {
				taskId: taskId,
				totalTasks: taskTotalChildren,
				completedTasks: taskCompletedChildren,
				completionPercentage: parseFloat(taskCompletionPercentage),
				status: task.status || 'notStarted',
			}
		} else {
			// Direct task without children
			totalTasks++
			if (task.status === 'completed') {
				completedTasks++
			}
		}
	})

	// Calculate overall completion percentage
	const overallCompletionPercentage = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0

	const progressStats = {
		// Overall project progress
		totalTasks,
		completedTasks,
		remainingTasks: totalTasks - completedTasks,
		completionPercentage: parseFloat(overallCompletionPercentage),
		projectStatus: project[0].status || 'notStarted',

		// Individual task progress (keyed by task ID)
		tasks: taskProgress,
	}
	return progressStats
}

// /**
//  * Log or send task completion statistics
//  * This can be used for analytics, notifications, or progress tracking
//  */
// async function reportTaskProgress(projectId, context = {}) {
//     const stats = await getTaskCompletionStats(projectId);

//     // Log the statistics
//     console.log(`Project ${projectId} Progress:`, {
//         ...stats,
//         context,
//         timestamp: new Date().toISOString(),
//     });

//     // Optional: Send to analytics service, notification service, etc.
//     // await analyticsService.trackProgress(projectId, stats);
//     // await notificationService.sendProgressUpdate(projectId, stats);

//     return stats;
// }

/**
 * Check if all children of a parent task are completed, if yes mark parent as completed
 */
async function checkAndCompleteParentTask(projectId, parentTaskId) {
	const project = await projectQueries.projectDocument(
		{
			_id: projectId,
			'tasks._id': parentTaskId,
		},
		['tasks._id', 'tasks.children._id', 'tasks.children.status', 'tasks.status']
	)

	if (!project.length > 0) {
		return
	}

	const parentTask = project[0].tasks.find((t) => String(t._id) === String(parentTaskId))

	if (!parentTask || !parentTask.children || parentTask.children.length === 0) {
		return
	}

	// Check if all children are completed
	const allChildrenCompleted = parentTask.children.every((child) => child.status === 'completed')

	if (allChildrenCompleted && parentTask.status !== 'completed') {
		// Mark parent task as completed
		await projectQueries.findOneAndUpdate(
			{
				_id: projectId,
				'tasks._id': parentTaskId,
			},
			{
				$set: {
					'tasks.$.status': 'completed',
					'tasks.$.updatedAt': new Date(),
				},
			}
		)
	}
}

/**
 * Check if all tasks are completed, if yes mark project as completed
 */
async function checkAndCompleteProject(projectId) {
	const project = await projectQueries.projectDocument({ _id: projectId }, [
		'tasks._id',
		'tasks.status',
		'tasks.children._id',
		'tasks.children.status',
		'status',
	])

	if (!project.length > 0) {
		return
	}

	// Step 1: Check and complete parent tasks if all their children are completed
	for (const task of project[0].tasks) {
		if (task.children && task.children.length > 0) {
			// Check if all children are completed
			const allChildrenCompleted = task.children.every((child) => child.status === 'completed')

			// If all children completed but parent is not, mark parent as completed
			if (allChildrenCompleted && task.status !== 'completed') {
				await projectQueries.findOneAndUpdate(
					{
						_id: projectId,
						'tasks._id': task._id,
					},
					{
						$set: {
							'tasks.$.status': 'completed',
							'tasks.$.updatedAt': new Date(),
						},
					}
				)
			}
		}
	}

	// Step 2: Fetch updated project data to check if all parent tasks are now completed
	const updatedProject = await projectQueries.projectDocument({ _id: projectId }, [
		'tasks._id',
		'tasks.status',
		'tasks.children._id',
		'tasks.children.status',
		'status',
	])

	if (!updatedProject.length > 0) {
		return
	}

	// Check if all parent tasks are completed
	const allTasksCompleted = updatedProject[0].tasks.every((task) => task.status === 'completed')

	// Step 3: Mark project as completed if all parent tasks are completed
	if (allTasksCompleted && updatedProject[0].status !== 'completed') {
		await projectQueries.findOneAndUpdate(
			{ _id: projectId },
			{
				$set: {
					status: 'completed',
					updatedAt: new Date(),
				},
			}
		)
	}
	return true
}
