/**
 * name : helper.js
 * author : Aman
 * created-date : 16-July-2020
 * Description : Project templates helper functionality.
 */

const { ObjectId } = require('mongodb')

/**
 * ProjectTemplatesHelper
 * @class
 */

// Dependencies

const libraryCategoriesHelper = require(MODULES_BASE_PATH + '/library/categories/helper')
const coreService = require(GENERICS_FILES_PATH + '/services/core')
// const kafkaProducersHelper = require(GENERICS_FILES_PATH + "/kafka/producers");
const learningResourcesHelper = require(MODULES_BASE_PATH + '/learningResources/helper')

const projectTemplateQueries = require(DB_QUERY_BASE_PATH + '/projectTemplates')
const projectTemplateTaskQueries = require(DB_QUERY_BASE_PATH + '/projectTemplateTask')
const projectQueries = require(DB_QUERY_BASE_PATH + '/projects')
const projectCategoriesQueries = require(DB_QUERY_BASE_PATH + '/projectCategories')
const solutionsQueries = require(DB_QUERY_BASE_PATH + '/solutions')
const certificateTemplateQueries = require(DB_QUERY_BASE_PATH + '/certificateTemplates')
const programQueries = require(DB_QUERY_BASE_PATH + '/programs')
const evidencesHelper = require(MODULES_BASE_PATH + '/evidences/helper')
const userExtensionQueries = require(DB_QUERY_BASE_PATH + '/userExtension')
const filesHelpers = require(MODULES_BASE_PATH + '/cloud-services/files/helper')
const testimonialsHelper = require(MODULES_BASE_PATH + '/testimonials/helper')
const surveyService = require(SERVICES_BASE_PATH + '/survey')
const solutionsUtils = require(GENERICS_FILES_PATH + '/helpers/solutionAndProjectTemplateUtils')
const entitiesService = require(GENERICS_FILES_PATH + '/services/entity-management')
const orgExtensionQueries = require(DB_QUERY_BASE_PATH + '/organizationExtension')
const adminHelper = require(MODULES_BASE_PATH + '/admin/helper')

module.exports = class ProjectTemplatesHelper {
	/**
	 * Extract csv information.
	 * @method
	 * @name extractCsvInformation
	 * @param {Object} csvData - csv data.
	 * @param {Object} userDetails - user related info
	 * @returns {Object} Extra csv information.
	 */

	static extractCsvInformation(csvData, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let categoryIds = []
				let roleIds = []
				let tasksIds = []
				// <- Entitytype added for observation as a task-->
				let entityTypes = []

				csvData.forEach((template) => {
					let parsedData = UTILS.valueParser(template)

					categoryIds = _.concat(categoryIds, parsedData.categories)

					tasksIds = _.concat(tasksIds, parsedData.tasks)

					if (parsedData.recommendedFor) {
						parsedData.recommendedFor = parsedData.recommendedFor.map((role) => {
							return role.toUpperCase()
						})

						roleIds = _.concat(roleIds, parsedData.recommendedFor)
					}
					// <- Entitytype added for observation as a task-->
					if (parsedData.entityType) {
						entityTypes.push(parsedData.entityType)
					}
				})

				let categoriesData = {}
				if (categoryIds.length > 0) {
					let matchQuery = {}
					matchQuery['tenantId'] = userDetails.tenantAndOrgInfo.tenantId
					matchQuery['externalId'] = { $in: categoryIds }
					// what is category documents
					let categories = await projectCategoriesQueries.categoryDocuments(matchQuery, ['externalId'])

					if (!categories.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.LIBRARY_CATEGORIES_NOT_FOUND,
						}
					}

					categoriesData = categories.reduce(
						(ac, category) => ({
							...ac,
							[category.externalId]: {
								_id: ObjectId(category._id),
								externalId: category.externalId,
							},
						}),
						{}
					)
				}

				// let recommendedFor = {};

				// if( roleIds.length > 0 ) {

				//     let userRolesData =
				//     await coreService.rolesDocuments({
				//         code : { $in : roleIds }
				//     },["code"]);

				//     if( !userRolesData.success ) {
				//         throw {
				//             message : CONSTANTS.apiResponses.USER_ROLES_NOT_FOUND,
				//             status : HTTP_STATUS_CODE.bad_request.status
				//         }
				//     }

				//     recommendedFor = userRolesData.data.reduce((ac,role)=> ({
				//         ...ac,
				//         [role.code] : {
				//             roleId : ObjectId(role._id),
				//             code : role.code
				//         }
				//     }),{});
				// }
				// <- Entitytype added for observation as a task-->
				let entityTypesData = {}

				if (entityTypes.length > 0) {
					let entityTypesDocument = await entitiesService.entityTypeDocuments({
						name: { $in: entityTypes },
						tenantId: userDetails.tenantAndOrgInfo.tenantId,
					})

					if (!entityTypesDocument.success) {
						throw {
							message: CONSTANTS.apiResponses.ENTITY_TYPES_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					entityTypesData = entityTypesDocument.data.reduce(
						(ac, entityType) => ({
							...ac,
							[entityType.name]: {
								_id: ObjectId(entityType._id),
								name: entityType.name,
							},
						}),
						{}
					)
				}
				return resolve({
					success: true,
					data: {
						categories: categoriesData,
						// roles : recommendedFor,
						// <- Entitytype validation removed {release-5.0.0} - entity generalisation
						entityTypes: entityTypesData,
					},
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				})
			}
		})
	}

	/**
	 * Template data.
	 * @method
	 * @name templateData
	 * @param {Object} data  - csv data.
	 * @param {Object} csvInformation - csv information.
	 * @param {String} userId - user id
	 * @param {Object} translationData - translation data object
	 * @returns {Object} Template data.
	 */

	static templateData(data, csvInformation, userId, translationData = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				let templatesDataModel = Object.keys(schemas['project-templates'].schema)
				let parsedData = UTILS.valueParser(data)
				delete parsedData._arrayFields

				let categories = []

				if (parsedData.categories && parsedData.categories.length > 0) {
					parsedData.categories.forEach((category) => {
						if (csvInformation.categories[category]) {
							return categories.push(csvInformation.categories[category])
						}
					})
				}

				parsedData.categories = categories

				// let recommendedFor = [];

				// if( parsedData.recommendedFor && parsedData.recommendedFor.length > 0 ) {
				//     parsedData.recommendedFor.forEach(recommended => {
				//         if( csvInformation.roles[recommended] ) {
				//             return recommendedFor.push(
				//                 csvInformation.roles[recommended]
				//             );
				//         }
				//     });
				// }

				// parsedData.recommendedFor = recommendedFor;
				// <- Entitytype added for observation as a task-->
				if (parsedData.entityType && parsedData.entityType !== '') {
					parsedData.entityType = csvInformation.entityTypes[parsedData.entityType].name
				}
				// duration has sent as a string we have to convert it into days
				if (parsedData.duration && parsedData.duration !== '') {
					parsedData.durationInDays = UTILS.convertDurationToDays(parsedData.duration)
				}

				let learningResources = await learningResourcesHelper.extractLearningResourcesFromCsv(parsedData)
				let evidences = await evidencesHelper.extractEvidencesFromCsv(parsedData)
				let testimonials = await testimonialsHelper.extractTestimonialsFromCsv(parsedData)
				parsedData.learningResources = learningResources.data
				parsedData.evidences = evidences.data
				parsedData.metaInformation = {}
				parsedData.metaInformation['testimonials'] = testimonials.data
				let booleanData = UTILS.getAllBooleanDataFromModels(schemas['project-templates'].schema)
				parsedData['hasStory'] = parsedData['hasStory'] == 'YES' ? true : false
				parsedData['hasSpotlight'] = parsedData['hasSpotlight'] == 'YES' ? true : false
				parsedData['isPrivate'] = parsedData['isPrivate'] == 'YES' ? true : false
				Object.keys(parsedData).forEach((eachParsedData) => {
					if (!templatesDataModel.includes(eachParsedData)) {
						if (
							!eachParsedData.startsWith('testimonial') &&
							!eachParsedData.startsWith('learningResources')
						) {
							parsedData.metaInformation[eachParsedData] = parsedData[eachParsedData]
							delete parsedData[eachParsedData]
						}
					} else {
						if (booleanData.includes(eachParsedData)) {
							parsedData[eachParsedData] = UTILS.convertStringToBoolean(parsedData[eachParsedData])
						}
					}
				})

				// add tranlsation data
				let translations = {}

				// iterate over each language
				Object.keys(translationData).forEach((key) => {
					if (!(key == 'en')) {
						const data = translationData[key]

						// iterate over the fields in each language
						Object.keys(data).forEach((item) => {
							const fieldSegments = item.split('.')
							// add the translated data to translations
							if (fieldSegments[0] == 'projectTemplate') {
								const requiredModelField = fieldSegments[fieldSegments.length - 1]
								if (fieldSegments.some((segment) => segment.includes('evidence'))) {
									translations[key]['evidences'] = translations[key]['evidences'] || {}
									translations[key]['evidences'][requiredModelField] =
										translations[key]['evidences'][requiredModelField] || []
									translations[key]['evidences'][requiredModelField].push(data[item])
								} else if (fieldSegments.some((segment) => segment.includes('learningResources'))) {
									translations[key]['learningResources'] =
										translations[key]['learningResources'] || {}
									translations[key]['learningResources'][requiredModelField] =
										translations[key]['learningResources'][requiredModelField] || []
									translations[key]['learningResources'][requiredModelField].push(data[item])
								} else if (fieldSegments.some((segment) => segment.includes('testimonial'))) {
									translations[key]['testimonials'] = translations[key]['testimonials'] || {}
									translations[key]['testimonials'][requiredModelField] =
										translations[key]['testimonials'][requiredModelField] || []
									translations[key]['testimonials'][requiredModelField].push(data[item])
								} else {
									translations[key] = translations[key] || {}
									if (['text', 'recommendedFor', 'categories'].includes(requiredModelField)) {
										// initialize the field if not already present
										translations[key][requiredModelField] =
											translations[key][requiredModelField] ||
											(requiredModelField === 'categories' ? {} : [])

										if (requiredModelField == 'recommendedFor') {
											translations[key][requiredModelField] = data[item].split(',')
										} else if (requiredModelField == 'categories') {
											translations[key][requiredModelField]['name'] = data[item].split(',')
										} else {
											translations[key][requiredModelField].push(data[item])
										}
									} else {
										translations[key][requiredModelField] = data[item]
									}
								}
							}
						})
					}
				})
				parsedData['translations'] = translations
				parsedData.isReusable = true
				return resolve(parsedData)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Bulk created project templates.
	 * @method
	 * @name bulkCreate - bulk create project templates.
	 * @param {Array} templates - csv templates data.
	 * @param {String} userId - logged in user id.
	 * @param {Array} translationFiles - translation files
	 * @returns {Object} Bulk create project templates.
	 */

	static bulkCreate(templates, userDetails, translationFiles = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				const tenantId = userDetails.tenantAndOrgInfo.tenantId
				const orgId = userDetails.tenantAndOrgInfo.orgId[0]

				// Check if organization extension exists for the loggedin user
				let orgExtension
				orgExtension = await orgExtensionQueries.orgExtenDocuments({
					tenantId,
					orgId,
				})

				//Throw error if org policy is not found
				if (!orgExtension || orgExtension.length === 0) {
					throw {
						success: false,
						status: HTTP_STATUS_CODE.not_found.status,
						message: CONSTANTS.apiResponses.ORG_EXTENSION_NOT_FOUND,
					}
				}
				orgExtension = Array.isArray(orgExtension) ? orgExtension[0] : orgExtension
				if (templates[0].solutionId && templates[0].solutionId !== '') {
					const isSolutionExist = await solutionsQueries.solutionsDocument({ _id: templates[0].solutionId })
					if (!isSolutionExist.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
						}
					}
				}

				const fileName = `project-templates-creation`
				let fileStream = new CSV_FILE_STREAM(fileName)
				let input = fileStream.initStream()

				;(async function () {
					await fileStream.getProcessorPromise()
					return resolve({
						isResponseAStream: true,
						fileNameWithPath: fileStream.fileNameWithPath(),
					})
				})()

				let csvInformation = await this.extractCsvInformation(templates, userDetails)
				if (!csvInformation.success) {
					return resolve(csvInformation)
				}

				// convert the translation files and store them in array
				let translationDataObject = {}
				if (Object.keys(translationFiles).length > 0) {
					const translationFilesCount = Array.isArray(translationFiles) ? translationFiles.length : 1
					let translationFilesInArray = []

					if (translationFilesCount <= 1) translationFilesInArray.push(translationFiles)
					else translationFilesInArray = translationFiles

					for (let i = 0; i < translationFilesCount; i++) {
						translationDataObject[`${i}`] = JSON.parse(translationFilesInArray[i].data.toString())
					}
				}

				let relatedOrgs = await solutionsUtils.organizationDetails(userDetails)
				if (!relatedOrgs || !relatedOrgs.success || !relatedOrgs.result) {
					throw {
						success: false,
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.ORG_DETAILS_FETCH_UNSUCCESSFUL,
					}
				}

				for (let template = 0; template < templates.length; template++) {
					let currentData = templates[template]
					// create match query
					let matchQuery = {}
					matchQuery['tenantId'] = tenantId
					matchQuery['status'] = CONSTANTS.common.PUBLISHED
					matchQuery['externalId'] = currentData.externalId
					matchQuery['isReusable'] = true
					let templateData = await projectTemplateQueries.templateDocument(matchQuery, ['_id'])

					if (templateData.length > 0 && templateData[0]._id) {
						currentData['_SYSTEM_ID'] = CONSTANTS.apiResponses.PROJECT_TEMPLATE_EXISTS
					} else {
						let translationData = translationDataObject[`${template.toString()}`]
						let templateData = await this.templateData(
							currentData,
							csvInformation.data,
							userDetails.userInformation.userId,
							translationData
						)

						templateData.status = CONSTANTS.common.PUBLISHED_STATUS
						templateData.createdBy =
							templateData.updatedBy =
							templateData.userId =
								userDetails.userInformation.userId
						templateData.isReusable = true
						templateData['tenantId'] = tenantId
						templateData['orgId'] = orgId
						templateData['visibility'] = orgExtension.projectResourceVisibilityPolicy
						templateData['visibleToOrganizations'] = [orgId, ...relatedOrgs.result]

						let createdTemplate = await projectTemplateQueries.createTemplate(templateData)

						if (!createdTemplate._id) {
							currentData['_SYSTEM_ID'] = CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND
						} else {
							currentData['_SYSTEM_ID'] = createdTemplate._id

							if (templateData.categories && templateData.categories.length > 0) {
								let categories = templateData.categories.map((category) => {
									return category._id
								})

								let updatedCategories = await libraryCategoriesHelper.update(
									{
										_id: { $in: categories },
									},
									{
										$inc: { noOfProjects: 1 },
									},
									{},
									userDetails
								)
								if (!updatedCategories.success) {
									currentData['_SYSTEM_ID'] = updatedCategories.message
								}
							}
						}
					}

					input.push(currentData)
				}

				input.push(null)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Bulk update project templates.
	 * @method
	 * @name bulkUpdate - bulk update project templates.
	 * @param {Array} templates - csv templates data.
	 * @param {String} userId - logged in user id.
	 * @returns {Object} Bulk Update Project templates.
	 */

	static bulkUpdate(templates, userId) {
		return new Promise(async (resolve, reject) => {
			try {
				if (templates[0].solutionId && templates[0].solutionId !== '') {
					const isSolutionExist = await solutionsQueries.solutionsDocument({ _id: templates[0].solutionId })
					if (!isSolutionExist.length > 0) {
						throw {
							status: HTTP_STATUS_CODE.bad_request.status,
							message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
						}
					}
				}

				const fileName = `project-templates-updation`
				let fileStream = new CSV_FILE_STREAM(fileName)
				let input = fileStream.initStream()

				;(async function () {
					await fileStream.getProcessorPromise()
					return resolve({
						isResponseAStream: true,
						fileNameWithPath: fileStream.fileNameWithPath(),
					})
				})()

				let csvInformation = await this.extractCsvInformation(templates)

				if (!csvInformation.success) {
					return resolve(csvInformation)
				}

				for (let template = 0; template < templates.length; template++) {
					const currentData = templates[template]

					if (!currentData._SYSTEM_ID) {
						currentData['UPDATE_STATUS'] = CONSTANTS.apiResponses.MISSING_PROJECT_TEMPLATE_ID
					} else {
						const template = await projectTemplateQueries.templateDocument(
							{
								status: CONSTANTS.common.PUBLISHED,
								_id: currentData._SYSTEM_ID,
								status: CONSTANTS.common.PUBLISHED,
							},
							['_id', 'categories', 'isReusable']
						)

						if (!(template.length > 0 && template[0]._id)) {
							currentData['UPDATE_STATUS'] = CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND
						} else {
							let templateData = await this.templateData(
								_.omit(currentData, ['_SYSTEM_ID']),
								csvInformation.data
							)

							if (template[0].isReusable === false) {
								templateData.isReusable = false
							}

							templateData.updatedBy = userId

							let projectTemplateUpdated = await projectTemplateQueries.findOneAndUpdate(
								{
									_id: currentData._SYSTEM_ID,
								},
								{
									$set: templateData,
								},
								{
									new: true,
								}
							)

							if (!projectTemplateUpdated || !projectTemplateUpdated._id) {
								currentData['UPDATE_STATUS'] = CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_UPDATED
							}

							// Add projects count to categories
							if (templateData.categories && templateData.categories.length > 0) {
								let categories = templateData.categories.map((category) => {
									return category._id
								})

								let updatedCategories = await libraryCategoriesHelper.update(
									{
										_id: { $in: categories },
									},
									{
										$inc: { noOfProjects: 1 },
									}
								)

								if (!updatedCategories.success) {
									currentData['UPDATE_STATUS'] = updatedCategories.message
								}
							}

							// Remove project count from existing categories
							if (template[0].categories && template[0].categories.length > 0) {
								const categoriesIds = template[0].categories.map((category) => {
									return category._id
								})

								let categoriesUpdated = await libraryCategoriesHelper.update(
									{
										_id: { $in: categoriesIds },
									},
									{
										$inc: { noOfProjects: -1 },
									}
								)

								if (!categoriesUpdated.success) {
									currentData['UPDATE_STATUS'] = updatedCategories.message
								}
							}

							currentData['UPDATE_STATUS'] = CONSTANTS.common.SUCCESS
						}
					}

					input.push(templates[template])
				}

				input.push(null)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * @function createChildProjectTemplate
	 * @description Creates child project templates by duplicating existing project templates
	 *              and linking them to a program solution.
	 *
	 * @param {Array<string>} projectTemplateExternalIds - List of external IDs of project templates to duplicate.
	 * @param {Object} userDetails - Information about the user performing the operation.
	 * @param {string} programExternalId - External ID of the program the templates belong to.
	 * @param {boolean} isExternalProgram - Flag to determine if the program is external.
	 * @param {string} entityType - Type of entity to be created.
	 * @returns {Promise<Object>} Resolves with:
	 *   - `success: true`, message, and `data` containing array of newly created project templates.
	 *   - `success: false` and error details if operation fails.
	 */
	static createChildProjectTemplate(
		projectTemplateExternalIds,
		userDetails,
		programExternalId,
		isExternalProgram,
		entityType = ''
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let responseData = []
				let failedTemplates = []
				let solutionIdsToDelete = []
				let childTemplateIds = []

				let taskTypes = [
					CONSTANTS.common.OBSERVATION,
					CONSTANTS.common.SURVEY,
					CONSTANTS.common.IMPROVEMENT_PROJECT,
				]
				for (const templateId of projectTemplateExternalIds) {
					try {
						let projectTemplateData = await projectTemplateQueries.templateDocument({
							status: CONSTANTS.common.PUBLISHED,
							externalId: templateId,
							isReusable: true,
						})
						if (!projectTemplateData?.length) {
							throw new Error(CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND)
						}

						// Prepare solution data based on project template
						const solutionData = {
							name: projectTemplateData[0].title,
							programExternalId: programExternalId,
							externalId: projectTemplateData[0].externalId + UTILS.generateUniqueId(),
							referenceFrom: CONSTANTS.common.OBSERVATION,
							entityType: projectTemplateData?.entityType ? projectTemplateData?.entityType : entityType,
						}

						// Create a solution for this project template
						let createdSolution = await solutionsUtils.createSolution(
							solutionData,
							true,
							userDetails,
							isExternalProgram,
							false
						)

						if (!createdSolution?.result?._id) {
							throw new Error(CONSTANTS.apiResponses.SOLUTION_NOT_CREATED)
						}
						// Store solution ID
						solutionIdsToDelete.push(createdSolution.result._id)
						// Import project template into the newly created solution
						let duplicateProjectTemplateId = await this.importProjectTemplate(
							templateId,
							userDetails.userInformation.userId,
							userDetails.userToken,
							createdSolution.result._id,
							{},
							userDetails,
							false
						)

						if (!duplicateProjectTemplateId?.success || !duplicateProjectTemplateId?.data?._id) {
							throw new Error(CONSTANTS.apiResponses.DUPLICATE_PROJECT_TEMPLATES_NOT_CREATED)
						}

						childTemplateIds.push(duplicateProjectTemplateId.data._id)

						// Add success
						responseData.push({
							parentExternalId: templateId,
							_id: duplicateProjectTemplateId.data._id,
							externalId: duplicateProjectTemplateId.data.externalId,
							isReusable: duplicateProjectTemplateId.data.isReusable,
							parentProjectTemplateId: projectTemplateData[0]._id,
							solutionId: duplicateProjectTemplateId.data.solutionId,
						})
					} catch (innerError) {
						// Continue even if one fails
						failedTemplates.push({
							parentExternalId: templateId,
							error: innerError.message,
						})
					}
				}

				// Determine final message
				let message = ''
				if (responseData.length && failedTemplates.length) {
					message = CONSTANTS.apiResponses.PARTIAL_CHILD_PROJECT_TEMPLATES_CREATED
				} else if (responseData.length && !failedTemplates.length) {
					message = CONSTANTS.apiResponses.DUPLICATE_PROJECT_TEMPLATES_CREATED
				} else {
					message = CONSTANTS.apiResponses.FAILED_TO_CREATE_TEMPLATE
				}

				// If anythings fail in between this logic will revert back those created data
				if (failedTemplates.length > 0) {
					for (const _id of solutionIdsToDelete) {
						await adminHelper.deletedResourceDetails(
							_id,
							CONSTANTS.common.SOLUTION,
							userDetails.tenantAndOrgInfo.tenantId,
							userDetails.tenantAndOrgInfo[0],
							userDetails.userInformation.userId
						)
					}
				}
				let programMatchQuery = {}
				if (UTILS.strictObjectIdCheck(programExternalId)) {
					programMatchQuery['_id'] = programExternalId
				} else {
					programMatchQuery['externalId'] = programExternalId
				}
				let programData = await programQueries.programsDocument(programMatchQuery, ['components'])
				if (!programData.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROGRAM_NOT_FOUND,
					}
				}
				const allSolutionDetails = await projectTemplateQueries.getAggregate([
					// Match required templates
					{ $match: { _id: { $in: childTemplateIds } } },

					// Lookup tasks
					{
						$lookup: {
							from: 'projectTemplateTasks', // collection name
							localField: 'tasks',
							foreignField: '_id',
							as: 'taskData',
						},
					},

					{ $unwind: '$taskData' },

					// Filter by allowed types
					{ $match: { 'taskData.type': { $in: taskTypes } } },

					// Project only solutionDetails
					{ $project: { solutionDetails: '$taskData.solutionDetails', _id: 0 } },

					// Flatten into one array
					{
						$group: {
							_id: null,
							allSolutions: { $push: '$solutionDetails' },
						},
					},

					// Remove any nulls
					{
						$project: {
							_id: 0,
							allSolutions: {
								$filter: { input: '$allSolutions', as: 's', cond: { $ne: ['$$s', null] } },
							},
						},
					},
				])
				// Extract only IDs as strings
				let taskSolutionIds = []

				if (allSolutionDetails?.[0]?.allSolutions?.length) {
					taskSolutionIds = allSolutionDetails[0].allSolutions.map((s) => s._id)
				}

				let componentsWithOrders = UTILS.addSolutionsWithOrdersForProgramComponent(
					programData?.[0]?.components,
					[...solutionIdsToDelete, ...taskSolutionIds]
				)
				let updateProgram = await programQueries.findAndUpdate(programMatchQuery, {
					$addToSet: {
						components: componentsWithOrders,
					},
				})
				if (updateProgram) {
					return resolve({
						success: true,
						message,
						data: {
							successfulTemplates: responseData,
							failedTemplates: failedTemplates,
							solutionIdsToUpdate: [...solutionIdsToDelete, ...taskSolutionIds],
						},
					})
				}
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
	 * Bulk update project templates.
	 * @method
	 * @name importProjectTemplate - import templates from existing project templates.
	 * @param {String} templateId - project template id.
	 * @param {String} userId - logged in user id.
	 * @param {String} userToken - logged in user token.
	 * @param {String} solutionId - solution id.
	 * @param {Object} updateData - template update data.
	 * @param {Boolean} isProgramUpdateRequired - if true then update program component.
	 * @returns {Object} imported templates data.
	 */

	static importProjectTemplate(
		templateId,
		userId,
		userToken,
		solutionId = '',
		updateData = {},
		userDetails,
		isProgramUpdateRequired = true
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let projectTemplateData = await projectTemplateQueries.templateDocument({
					status: CONSTANTS.common.PUBLISHED,
					externalId: templateId,
					isReusable: true,
				})
				if (!projectTemplateData.length > 0) {
					throw new Error(CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND)
				}

				let newProjectTemplate = { ...projectTemplateData[0] }
				newProjectTemplate.externalId = projectTemplateData[0].externalId + '-' + UTILS.epochTime()
				newProjectTemplate.createdBy = newProjectTemplate.updatedBy = userId
				let solutionData
				if (solutionId) {
					solutionData = await solutionsQueries.solutionsDocument({ _id: ObjectId(solutionId) })
					// if( !solutionData.length >0 ) {
					//     throw {
					//         message : CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
					//         status : HTTP_STATUS_CODE.bad_request.status
					//     }
					// }
					if (solutionData.length > 0 && solutionData[0].type !== CONSTANTS.common.IMPROVEMENT_PROJECT) {
						throw {
							message: CONSTANTS.apiResponses.IMPROVEMENT_PROJECT_SOLUTION_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					if (solutionData.length > 0 && solutionData[0].projectTemplateId) {
						throw {
							message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_EXISTS_IN_SOLUTION,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					if (
						solutionData.length > 0 &&
						projectTemplateData[0].entityType &&
						projectTemplateData[0].entityType !== '' &&
						projectTemplateData[0].entityType !== solutionData[0].entityType
					) {
						throw {
							message: CONSTANTS.apiResponses.ENTITY_TYPE_MIS_MATCHED,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					if (solutionData.length > 0) {
						newProjectTemplate.solutionId = solutionData[0]._id
						newProjectTemplate.solutionExternalId = solutionData[0].externalId
						newProjectTemplate.programId = solutionData[0].programId
						newProjectTemplate.programExternalId = solutionData[0].programExternalId
					}
				}

				let programDetails = {
					programId: solutionData[0].programId,
					programName: solutionData[0].programName,
					programDescription: solutionData[0].programDescription,
					programExternalId: solutionData[0].programExternalId,
				}

				newProjectTemplate.parentTemplateId = projectTemplateData[0]._id

				let updationKeys = Object.keys(updateData)
				if (updationKeys.length > 0) {
					updationKeys.forEach((singleKey) => {
						if (newProjectTemplate[singleKey]) {
							newProjectTemplate[singleKey] = updateData[singleKey]
						}
					})
				}

				let tasksIds

				if (projectTemplateData[0].tasks) {
					tasksIds = projectTemplateData[0].tasks
				}

				newProjectTemplate.isReusable = false

				let duplicateTemplateDocument = await projectTemplateQueries.createTemplate(
					_.omit(newProjectTemplate, ['_id'])
				)
				if (!duplicateTemplateDocument._id) {
					throw new Error(CONSTANTS.apiResponses.PROJECT_TEMPLATES_NOT_CREATED)
				}

				//duplicate task
				if (Array.isArray(tasksIds) && tasksIds.length > 0) {
					await this.duplicateTemplateTasks(
						tasksIds,
						duplicateTemplateDocument._id,
						duplicateTemplateDocument.externalId,
						programDetails,
						userToken,
						duplicateTemplateDocument.taskSequence,
						userDetails,
						isProgramUpdateRequired
					)
				}

				if (solutionId) {
					await solutionsQueries.updateSolutionDocument(
						{ _id: solutionId },
						{
							projectTemplateId: duplicateTemplateDocument._id,
							name: duplicateTemplateDocument.title,
						}
					)
				}

				await this.ratings(projectTemplateData[0]._id, updateData.rating, userToken)

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.DUPLICATE_PROJECT_TEMPLATES_CREATED,
					data: {
						_id: duplicateTemplateDocument._id,
						externalId: newProjectTemplate.externalId,
						isReusable: newProjectTemplate.isReusable,
						solutionId: duplicateTemplateDocument.solutionId,
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
	 * Create ratings.
	 * @method
	 * @name ratings
	 * @param {String} templateId - project template id.
	 * @param {String} rating - rating for template.
	 * @returns {Object} rating object.
	 */

	static ratings(templateId, rating, userToken) {
		return new Promise(async (resolve, reject) => {
			try {
				let userProfileData = await coreService.getProfile(userToken)

				if (!userProfileData.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.USER_PROFILE_NOT_FOUND,
					}
				}

				let templateData = await projectTemplateQueries.templateDocument(
					{
						status: CONSTANTS.common.PUBLISHED,
						_id: templateId,
						isReusable: true,
					},
					['averageRating', 'noOfRatings', 'ratings']
				)

				let updateRating = {
					ratings: { ...templateData[0].ratings },
				}

				updateRating.ratings[rating] += 1

				let userCurrentRating = 0
				let projectIndex = -1

				if (userProfileData.data && userProfileData.data.ratings && userProfileData.data.ratings.length > 0) {
					projectIndex = userProfileData.data.ratings.findIndex(
						(project) => project._id.toString() === templateId.toString()
					)

					if (!(projectIndex < 0)) {
						userCurrentRating = userProfileData.data.ratings[projectIndex].rating
						updateRating.ratings[userCurrentRating] -= 1
					}
				} else {
					userProfileData.data.ratings = []
				}

				let ratingUpdated = {}

				if (userCurrentRating === rating) {
					ratingUpdated = templateData[0]
				} else {
					let calculateRating = _calculateRating(updateRating.ratings)
					updateRating.averageRating = calculateRating.averageRating
					updateRating.noOfRatings = calculateRating.noOfRatings

					ratingUpdated = await projectTemplateQueries.findOneAndUpdate(
						{
							_id: templateId,
						},
						{
							$set: updateRating,
						},
						{
							new: true,
						}
					)

					let improvementProjects = [...userProfileData.data.ratings]
					if (projectIndex >= 0) {
						improvementProjects[projectIndex].rating = rating
					} else {
						improvementProjects.push({
							_id: ObjectId(templateId),
							externalId: ratingUpdated.externalId,
							rating: rating,
							type: CONSTANTS.common.IMPROVEMENT_PROJECT,
						})
					}

					await coreService.updateUserProfile(userToken, {
						ratings: improvementProjects,
					})
				}

				return resolve(_.pick(ratingUpdated, ['averageRating', 'noOfRatings', 'ratings']))
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				})
			}
		})
	}

	/**
	 * Project template tasks
	 * @method
	 * @name duplicateTemplateTasks
	 * @param {Array} taskIds - Task ids
	 * @param {String} duplicateTemplateId- MongoId of child template
	 * @param {String} duplicateTemplateExternalId - External Id  child template
	 * @param {Object} programDetails - ProgramDetails
	 * @param {String} userToken-userToken
	 * @param {Array} taskSequence - task Sequence array of parent template
	 * @param {Object} userDetails - This is req.userDetails
	 * @param {Boolean} isProgramUpdateRequired - if true then update program component.
	 * @returns {Object} Duplicated tasks.
	 */

	static duplicateTemplateTasks(
		taskIds = [],
		duplicateTemplateId,
		duplicateTemplateExternalId,
		programDetails,
		userToken,
		taskSequence,
		userDetails,
		isProgramUpdateRequired = true
	) {
		return new Promise(async (resolve, reject) => {
			try {
				let newTaskId = []

				for (let pointerToTask = 0; pointerToTask < taskIds.length; pointerToTask++) {
					let taskId = taskIds[pointerToTask]
					let taskData = await projectTemplateTaskQueries.taskDocuments({
						_id: taskId,
						parentId: { $exists: false },
					})

					if (taskData && taskData.length > 0) {
						taskData = taskData[0]
					}
					if (taskData && Object.keys(taskData).length > 0) {
						//duplicate parent task
						let newProjectTemplateTask = { ...taskData }
						newProjectTemplateTask.projectTemplateId = duplicateTemplateId
						newProjectTemplateTask.projectTemplateExternalId = duplicateTemplateExternalId
						newProjectTemplateTask.externalId = taskData.externalId + '-' + UTILS.epochTime()
						newProjectTemplateTask.programId = programDetails.programId
						newProjectTemplateTask.programName = programDetails.programName
						newProjectTemplateTask.programDescription = programDetails.programDescription
						newProjectTemplateTask.programExternalId = programDetails.programExternalId
						let duplicateTemplateTask = await this.handleDuplicateTemplateTask(
							userToken,
							newProjectTemplateTask,
							taskData,
							taskSequence,
							userDetails,
							isProgramUpdateRequired
						)
						newTaskId.push(duplicateTemplateTask)

						//duplicate child task
						if (duplicateTemplateTask.children && duplicateTemplateTask.children.length > 0) {
							let childTaskIdArray = []
							let childTaskIds = duplicateTemplateTask.children

							if (childTaskIds && childTaskIds.length > 0) {
								for (let pointerToChild = 0; pointerToChild < childTaskIds.length; pointerToChild++) {
									let childtaskId = childTaskIds[pointerToChild]
									let childTaskData = await projectTemplateTaskQueries.taskDocuments({
										_id: childtaskId,
									})

									if (childTaskData && childTaskData.length > 0) {
										childTaskData = childTaskData[0]
									}

									if (childTaskData && Object.keys(childTaskData).length > 0) {
										let newProjectTemplateChildTask = { ...childTaskData }
										newProjectTemplateChildTask.projectTemplateId = duplicateTemplateId
										newProjectTemplateChildTask.projectTemplateExternalId =
											duplicateTemplateExternalId
										newProjectTemplateChildTask.parentId = duplicateTemplateTask._id
										newProjectTemplateChildTask.externalId =
											childTaskData.externalId + '-' + UTILS.epochTime()

										let duplicateChildTemplateTask =
											await projectTemplateTaskQueries.createTemplateTask(
												_.omit(newProjectTemplateChildTask, ['_id'])
											)

										childTaskIdArray.push(duplicateChildTemplateTask._id)
										newTaskId.push(duplicateChildTemplateTask._id)
									}
								}
								//update new subtask ids to parent task
								if (childTaskIdArray && childTaskIdArray.length > 0) {
									let updateTaskData = await projectTemplateTaskQueries.updateTaskDocument(
										{
											_id: duplicateTemplateTask._id,
										},
										{
											$set: {
												children: childTaskIdArray,
											},
										}
									)
								}
							}
						}
					}
				}

				// }
				let updateDuplicateTemplate
				//adding duplicate tasj to duplicate template
				if (newTaskId && newTaskId.length > 0) {
					updateDuplicateTemplate = await projectTemplateQueries.findOneAndUpdate(
						{
							_id: duplicateTemplateId,
						},
						{
							$set: {
								tasks: newTaskId,
								taskSequence: taskSequence,
							},
						}
					)
				}
				return resolve(updateDuplicateTemplate)
			} catch (error) {
				return reject(error)
			}
		})
	}
	/**
	 *  Details for creating child TemplateTask
	 * @method
	 * @name handleDuplicateTemplateTask
	 * @param {String} userToken-userToken
	 * @param {Array} taskIds - Task ids
	 * @param {Object} newProjectTemplateTask - Child taskDetails
	 * @param {Object} taskData - parent templatetask Details
	 * @param {Array} taskSequence - task Sequence array of parent template
	 * @param {Object} userDetails - This is req.userDetails
	 * @param {Boolean} isProgramUpdateRequired - if true then update program component.
	 * @returns {Object} Duplicated tasks.
	 */
	static async handleDuplicateTemplateTask(
		userToken,
		newProjectTemplateTask,
		taskData,
		taskSequence,
		userDetails,
		isProgramUpdateRequired = true
	) {
		try {
			const taskType = newProjectTemplateTask.type
			const newProjectTemplateTaskId = newProjectTemplateTask._id
			let duplicateTemplateTaskId

			let programs = await programQueries.programsDocument(
				{
					_id: newProjectTemplateTask.programId,
				},
				['components']
			)

			let nextComponentOrder = programs && programs.length > 0 ? programs[0]?.components?.length || 0 : 0

			const updateTaskSequence = () => {
				const index = taskSequence.indexOf(taskData.externalId)
				if (index !== -1) {
					taskSequence[index] = newProjectTemplateTask.externalId
				}
			}
			// create duplicate templateTask
			const createTemplateTask = async () => {
				const task = await projectTemplateTaskQueries.createTemplateTask(
					_.omit(newProjectTemplateTask, ['_id'])
				)
				if (!task._id) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_TASKS_NOT_CREATED,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}
				return task._id
			}
			// getting solutionDetails to store in tasks document
			const fetchSolutionDetails = (solution) => ({
				type: solution.type,
				subType: solution.entityType,
				_id: solution._id,
				externalId: solution.externalId,
				name: solution.name,
				isReusable: solution.isReusable,
				...(solution.type === CONSTANTS.common.OBSERVATION && {
					minNoOfSubmissionsRequired:
						newProjectTemplateTask?.solutionDetails?.minNoOfSubmissionsRequired ??
						CONSTANTS.common.DEFAULT_SUBMISSION_REQUIRED,
					allowMultipleAssessemts: solution.allowMultipleAssessemts
						? solution.allowMultipleAssessemts
						: false,
				}),
				parentTaskId: newProjectTemplateTaskId,
			})

			//fetchSolution details
			const fetchSolutionByExternalId = async (externalId) => {
				let result = {}
				// For project service solutionDetails we will get objectId in externalId param and for samiksha we will get externalId so using that to fetch the solution data
				let validateTemplateId = UTILS.isValidMongoId(externalId.toString())
				if (validateTemplateId) {
					//Query project service to get project solutionDetails
					let projection = ['type', 'entityType', '_id', 'externalId', 'name', 'isReusable']
					result = await solutionsQueries.solutionsDocument({ _id: externalId }, projection)
					result.data = result
					if (!result?.data?.length > 0) {
						throw {
							message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
				} else {
					//Query samiksha service to get obs/survey solutionDetails
					result = await surveyService.listSolutions(
						{ externalId: { $in: [externalId] } },
						userToken,
						userDetails
					)
					if (!result?.success || !result?.data?.length) {
						throw {
							message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
				}
				return fetchSolutionDetails(result.data[0])
			}
			//update  duplicate template and duplicateTemplate task in child solutions
			const updateSolutionReferenceForProject = async (templateId, taskId, solutionId) => {
				let validateMongoId = UTILS.isValidMongoId(solutionId.toString())

				let updateSolutionObj = {
					referenceFrom: CONSTANTS.common.PROJECT,
					project: {
						_id: templateId.toString(),
						taskId: taskId.toString(),
					},
				}
				let solutionUpdated
				if (validateMongoId) {
					solutionUpdated = await solutionsUtils.update(solutionId, updateSolutionObj, userDetails)
				} else {
					solutionUpdated = await surveyService.updateSolution(
						userToken,
						updateSolutionObj,
						solutionId,
						userDetails
					)
				}
				if (!solutionUpdated.success) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.SOLUTION_NOT_UPDATED,
					}
				}
			}

			if (
				taskType === CONSTANTS.common.IMPROVEMENT_PROJECT &&
				(newProjectTemplateTask?.solutionDetails?.isReusable ||
					newProjectTemplateTask?.projectTemplateDetails?.isReusable)
			) {
				//create new solution for project as a task template under same program as project's program
				let solutionData = {
					programExternalId: newProjectTemplateTask.programExternalId,
					externalId: newProjectTemplateTask.projectTemplateExternalId + '-' + UTILS.epochTime(),
					excludeScope: true, // excluding scope for creation
				}
				let newSolution = await solutionsUtils.createSolution(
					solutionData,
					false,
					userDetails,
					false,
					isProgramUpdateRequired
				)
				if (newSolution?.data && !newSolution?.data?._id) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.SOLUTION_NOT_CREATED,
					}
				}
				//create a child template of project as a task template
				let createChildTemplateforTask = await this.importProjectTemplate(
					newProjectTemplateTask.projectTemplateDetails.externalId,
					userDetails.userInformation.userId,
					userToken,
					newSolution?.data?._id.toString(),
					'',
					userDetails,
					isProgramUpdateRequired
				)

				if (!createChildTemplateforTask.success || !createChildTemplateforTask?.data?._id) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.DUPLICATE_PROJECT_TEMPLATES_NOT_CREATED,
					}
				}
				//replacing projectTemplateDetails with child projectTemplate Details
				newProjectTemplateTask.projectTemplateDetails._id = createChildTemplateforTask.data._id
				newProjectTemplateTask.projectTemplateDetails.externalId = createChildTemplateforTask.data.externalId
				newProjectTemplateTask.projectTemplateDetails.isReusable = false

				//fetch solution details based on created child solutionexternalId
				newProjectTemplateTask.solutionDetails = await fetchSolutionByExternalId(newSolution.data._id)

				duplicateTemplateTaskId = await createTemplateTask()
				updateTaskSequence()
				await updateSolutionReferenceForProject(
					newProjectTemplateTask.projectTemplateId,
					duplicateTemplateTaskId,
					newSolution.data._id
				)
			} else if (
				taskType === CONSTANTS.common.OBSERVATION &&
				newProjectTemplateTask?.solutionDetails?.isReusable
			) {
				const timestamp = UTILS.epochTime()
				//Create child solutions for solutiontype obs
				const importSolutionsResponse = await surveyService.importTemplateToSolution(
					userToken,
					newProjectTemplateTask.solutionDetails._id,
					'',
					{
						name: `${newProjectTemplateTask.solutionDetails.name}`,
						externalId: `${newProjectTemplateTask.solutionDetails.externalId}-${timestamp}`,
						description: `${newProjectTemplateTask.solutionDetails.name}`,
						programExternalId: newProjectTemplateTask.programId,
						status: CONSTANTS.common.PUBLISHED_STATUS,
					},
					userDetails,
					taskType
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
				//fetch solution details based on created child solutionexternalId
				newProjectTemplateTask.solutionDetails = await fetchSolutionByExternalId(
					importSolutionsResponse.data.externalId
				)
				//create duplicate
				duplicateTemplateTaskId = await createTemplateTask()
				updateTaskSequence()
				//update solution with  project and refernce from
				await updateSolutionReferenceForProject(
					newProjectTemplateTask.projectTemplateId,
					duplicateTemplateTaskId,
					importSolutionsResponse.result.externalId
				)

				//updating programComponents
				if (isProgramUpdateRequired) {
					await programQueries.findAndUpdate(
						{
							_id: newProjectTemplateTask.programId,
						},
						{
							$addToSet: {
								components: {
									_id: new ObjectId(newProjectTemplateTask.solutionDetails._id),
									order: ++nextComponentOrder,
								},
							},
						}
					)
				}
			} else if (taskType === CONSTANTS.common.SURVEY && newProjectTemplateTask?.solutionDetails?.isReusable) {
				//Create child solutions for solutiontype survey
				let importSolutionsResponse = await surveyService.importTemplateToSolution(
					userToken,
					newProjectTemplateTask.solutionDetails._id,
					newProjectTemplateTask.programId,
					'',
					userDetails,
					taskType
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

				newProjectTemplateTask.solutionDetails = await fetchSolutionByExternalId(
					importSolutionsResponse.result.solutionExternalId
				)
				duplicateTemplateTaskId = await createTemplateTask()
				updateTaskSequence()
				//update solution with  project and refernce from
				await updateSolutionReferenceForProject(
					newProjectTemplateTask.projectTemplateId,
					duplicateTemplateTaskId,
					importSolutionsResponse.result.solutionExternalId
				)
				//updating programComponents
				if (isProgramUpdateRequired) {
					await programQueries.findAndUpdate(
						{
							_id: newProjectTemplateTask.programId,
						},
						{
							$addToSet: {
								components: {
									_id: new ObjectId(newProjectTemplateTask.solutionDetails._id),
									order: ++nextComponentOrder,
								},
							},
						}
					)
				}
			} else {
				// Default fallback task creation
				duplicateTemplateTaskId = await createTemplateTask()
			}

			return duplicateTemplateTaskId
		} catch (error) {
			throw error
		}
	}

	/**
	 * Project templates the daily nudges in brac-utility-service look at.
	 * @method
	 * @name nudgeCandidates
	 * @param {String} tenantId - tenant code.
	 * @returns {Object} every template of the tenant with how many projects were created from it.
	 */
	static async nudgeCandidates(tenantId) {
		if (!tenantId) {
			throw {
				status: HTTP_STATUS_CODE.bad_request.status,
				message: 'tenantId is required',
			}
		}
		const templates = await projectTemplateQueries.templateDocument({ tenantId, isDeleted: false }, [
			'_id',
			'title',
			'isReusable',
			'status',
			'createdAt',
		])
		const usage = await database.models.projects.aggregate([
			{ $match: { tenantId, projectTemplateId: { $in: templates.map((template) => template._id) } } },
			{ $group: { _id: '$projectTemplateId', count: { $sum: 1 } } },
		])
		const projectCount = Object.fromEntries(usage.map((item) => [String(item._id), item.count]))
		return {
			success: true,
			message: 'Project templates fetched successfully',
			data: templates.map((template) => ({ ...template, projectCount: projectCount[String(template._id)] || 0 })),
		}
	}

	/**
	 * Templates list.
	 * @method
	 * @name listByIds
	 * @param {Array} externalIds - External ids
	 * @param {Object} userDetails - loggedin user info
	 * @returns {Array} List of templates data.
	 */

	static listByIds(externalIds, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const tenantId = userDetails.tenantAndOrgInfo.tenantId
				let templateData = await projectTemplateQueries.templateDocument(
					{
						externalId: { $in: externalIds },
						tenantId,
					},
					['title', 'metaInformation.goal', 'externalId', 'solutionId', 'isReusable']
				)

				if (!templateData.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
					}
				}

				templateData = templateData.map((template) => {
					if (template.metaInformation && template.metaInformation.goal) {
						template.goal = template.metaInformation.goal
						delete template.metaInformation
					}

					return template
				})

				return resolve({
					success: true,
					data: templateData,
					message: CONSTANTS.apiResponses.PROJECT_TEMPLATES_FETCHED,
				})
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Template details.
	 * @method
	 * @name details
	 * @param {String} templateId - Project template id.
	 * @param {String} userId - logged in user id.
	 * @param {String} link - solution link.
	 * @param {String} language- languageCode
	 * @param {Object} userDetails - loggedin user's info
	 * @returns {Array} Project templates data.
	 */

	static details(templateId = '', link = '', userId = '', isAPrivateProgram, language = '', userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionsResult = {}
				let findQuery = {}
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				//get data when link is given
				if (link != '') {
					let queryData = {}
					queryData['link'] = link
					queryData['tenantId'] = tenantId

					//   fetch solution details based on the link
					let solutionDocument = await solutionsQueries.solutionsDocument(queryData, [
						'_id',
						'name',
						'programId',
						'programName',
						'projectTemplateId',
						'link',
					])

					if (!(solutionDocument.length > 0)) {
						throw {
							message: CONSTANTS.apiResponses.SOLUTION_NOT_FOUND,
							status: HTTP_STATUS_CODE.bad_request.status,
						}
					}
					let solutiondata = solutionDocument
					templateId = solutiondata[0].projectTemplateId
					if (!templateId) {
						return resolve({
							success: false,
							data: solutiondata,
							message: CONSTANTS.apiResponses.TEMPLATE_ID_NOT_FOUND_IN_SOLUTION,
						})
					}
					solutionsResult = solutiondata
					templateId = templateId.toString()
				}
				// fetch project template details using project template id
				if (templateId) {
					let validateTemplateId = UTILS.isValidMongoId(templateId.toString())
					if (validateTemplateId) {
						findQuery['_id'] = templateId
					} else {
						findQuery['externalId'] = templateId
					}
				}

				findQuery['tenantId'] = tenantId
				//getting template data using templateId
				let templateData = await projectTemplateQueries.templateDocument(findQuery, 'all', [
					'ratings',
					'noOfRatings',
					'averageRating',
					'parentTemplateId',
					'userId',
					'createdBy',
					'updatedBy',
					'createdAt',
					'updatedAt',
					'__v',
				])
				// Fetch downloadable urls for the category evidences
				if (templateData[0].categories && templateData[0].categories.length > 0) {
					// iterate over each category
					let allFilePaths = []
					for (let cateogry of templateData[0].categories) {
						let evidences = cateogry.evidences

						// iterate over each evidence in a category
						if (evidences && evidences.length > 0) {
							// iterate over each evidence and fetch the filepaths
							for (let evidence of evidences) {
								if (evidence.filepath && evidence.filepath !== '') {
									allFilePaths.push(evidence.filepath)
								}
							}
						}
					}

					if (allFilePaths.length > 0) {
						let flattenedFilePathArr = _.flatten(allFilePaths)

						let downloadableUrlsCall = await filesHelpers.getDownloadableUrl(flattenedFilePathArr)
						// Attach the downloadableUrls for the evidences in the response
						if (
							downloadableUrlsCall.message == CONSTANTS.apiResponses.CLOUD_SERVICE_SUCCESS_MESSAGE &&
							downloadableUrlsCall.result &&
							downloadableUrlsCall.result.length > 0
						) {
							const downloadableUrls = downloadableUrlsCall.result

							for (let cateogry of templateData[0].categories) {
								let evidences = cateogry.evidences

								// iterate over each evidence in a category
								if (evidences && evidences.length > 0) {
									// iterate over each evidence and fetch the filepaths
									for (let evidence of evidences) {
										if (evidence.filepath && evidence.filepath !== '') {
											// iterate over each downloadbleUrl to handle worst case (in worst case every evidence in every category can have same evidence)
											for (const item of downloadableUrls) {
												if (evidence.filepath == item.filePath) {
													evidence['downloadableUrl'] = item.url ? item.url : ''
													break
												}
											}
										}
									}
								}
							}
						}
					}
				}

				// Fetch downloadable urls for the project evidences
				if (templateData[0].evidences && templateData[0].evidences.length > 0) {
					let allFilePaths = templateData[0].evidences.map((evidence) => {
						return evidence.link
					})
					let downloadableUrlsCall
					if (allFilePaths && allFilePaths.length > 0) {
						let flattenedFilePathArr = _.flatten(allFilePaths)

						downloadableUrlsCall = await filesHelpers.getDownloadableUrl(flattenedFilePathArr)
					}
					// Attach the downloadableUrls for the evidences in the response
					if (
						downloadableUrlsCall.message == CONSTANTS.apiResponses.CLOUD_SERVICE_SUCCESS_MESSAGE &&
						downloadableUrlsCall.result &&
						downloadableUrlsCall.result.length > 0
					) {
						const downloadableUrls = downloadableUrlsCall.result
						for (const item of downloadableUrls) {
							templateData[0].evidences.map((evidence) => {
								if (evidence.link == item.filePath) {
									evidence['downloadableUrl'] = item.url ? item.url : ''
								}
							})
						}
					}
				}

				if (!(templateData.length > 0)) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
					}
				}
				templateData[0].wishlist = false
				let wishlistData
				if (userId !== '') {
					// check if template is wishlisted by user
					wishlistData = await userExtensionQueries.findOne({
						userId: userId,
						'wishlist._id': String(templateData[0]._id),
						tenantId,
					})
				}
				if (wishlistData !== null) {
					templateData[0].wishlist = true
				}

				if (templateData[0].metaInformation) {
					Object.keys(templateData[0].metaInformation).forEach((projectMetaKey) => {
						templateData[0][projectMetaKey] = templateData[0].metaInformation[projectMetaKey]
					})
				}
				if (language !== '' && templateData[0].translations && templateData[0].translations[language]) {
					templateData[0] = UTILS.getTranslatedData(templateData[0], templateData[0].translations[language])
				}
				templateData[0] = _.omit(templateData[0], 'translations')
				// fetch certificate details using certificateTemplateId saved in projectTemplate
				if (templateData[0].certificateTemplateId && templateData[0].certificateTemplateId !== '') {
					let certificateTemplateDetails = await certificateTemplateQueries.certificateTemplateDocument(
						{
							_id: templateData[0].certificateTemplateId,
							tenantId: tenantId,
						},
						['criteria']
					)

					//certificate template data do not exists.
					if (!(certificateTemplateDetails.length > 0)) {
						throw {
							message: CONSTANTS.apiResponses.CERTIFICATE_TEMPLATE_NOT_FOUND,
						}
					}
					templateData[0].criteria = certificateTemplateDetails[0].criteria
				}

				if (templateData[0].tasks && templateData[0].tasks.length > 0) {
					templateData[0].tasks = await this.tasksAndSubTasks(templateData[0]._id, language, tenantId, orgId)
				}
				let result = await _templateInformation(templateData[0])
				if (!result.success) {
					return resolve(result)
				}

				if (!templateData[0].isReusable && userId !== '') {
					templateData[0].projectId = ''

					const projectIdQuery = {
						userId: userId,
						projectTemplateId: templateData[0]._id,
						tenantId: tenantId,
					}

					if (isAPrivateProgram !== '') {
						projectIdQuery.isAPrivateProgram = isAPrivateProgram
					}
					let project = await projectQueries.projectDocument(projectIdQuery, [
						'_id',
						'hasAcceptedTAndC',
						'metaInformation',
					])
					if (project && project.length > 0) {
						templateData[0].projectId = project[0]._id
						templateData[0].hasAcceptedTAndC = project[0].hasAcceptedTAndC
						result.data['projectMetaInformation'] = project[0].metaInformation
					}
				}
				if (!result.data.programInformation) {
					result.data.programInformation = {
						programId: solutionsResult.programId,
						programName: solutionsResult.programName,
					}
				}
				result.data.solutionInformation = {
					_id: solutionsResult._id,
					name: solutionsResult.name,
					link: solutionsResult.link,
				}
				return resolve({
					success: true,
					data: result.data,
					result: result.data,
					message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_DETAILS_FETCHED,
				})
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Tasks and sub tasks.
	 * @method
	 * @name tasksAndSubTasks
	 * @param {Array} templateId - Template id.
	 * @param {String} language - language code
	 * @param {String} tenantId - loggedin user's tenant id
	 * @param {String} orgId - loggedin user's org id
	 * @returns {Array} Tasks and sub task.
	 */

	static tasksAndSubTasks(templateId, language, tenantId, orgId) {
		return new Promise(async (resolve, reject) => {
			try {
				const templateDocument = await projectTemplateQueries.templateDocument(
					{
						_id: templateId,
						status: CONSTANTS.common.PUBLISHED,
						tenantId: tenantId,
					},
					['tasks', 'taskSequence']
				)

				let tasks = []

				if (templateDocument[0].taskSequence && templateDocument[0].taskSequence.length > 0) {
					let projectionKey = CONSTANTS.common.TASK_SEQUENCE
					let findQuery = {
						externalId: {
							$in: templateDocument[0].taskSequence,
						},
					}

					tasks = await _taskAndSubTaskinSequence(findQuery, projectionKey, language)
					// sort the order of the tasks
					let orderedTasks = templateDocument[0]['taskSequence'].map((id) =>
						tasks.find((task) => String(task.externalId) === String(id))
					)
					tasks = orderedTasks
				} else {
					if (templateDocument[0].tasks && templateDocument[0].tasks.length > 0) {
						let projectionKey = CONSTANTS.common.CHILDREN
						if (templateDocument[0].tasks) {
							let findQuery = {
								_id: {
									$in: templateDocument[0].tasks,
								},
								parentId: { $exists: false },
							}

							tasks = await _taskAndSubTaskinSequence(findQuery, projectionKey, language)
							// sort the order of the tasks
							let orderedTasks = templateDocument[0]['tasks'].map((id) =>
								tasks.find((task) => String(task._id) === String(id))
							)
							tasks = orderedTasks
						}
					}
				}

				return resolve(tasks)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Template update.
	 * @method
	 * @name update
	 * @param {String} templateId - Project template id.
	 * @param {Object} templateData - template updation data
	 * @param {String} userId - logged in user id.
	 * @returns {Array} Project templates data.
	 */

	static update(templateId, templateData, userId) {
		return new Promise(async (resolve, reject) => {
			try {
				let findQuery = {}

				let validateTemplateId = UTILS.isValidMongoId(templateId)

				if (validateTemplateId) {
					findQuery['_id'] = templateId
				} else {
					findQuery['externalId'] = templateId
				}

				let templateDocument = await projectTemplateQueries.templateDocument(findQuery, ['_id'])

				if (!templateDocument.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND,
					}
				}

				let updateObject = {
					$set: {},
				}

				if (
					templateData.metaInformation &&
					templateData.metaInformation.duration &&
					templateData.metaInformation.duration !== ''
				) {
					templateData.durationInDays = UTILS.convertDurationToDays(templateData.metaInformation.duration)
				}
				let templateUpdateData = templateData

				Object.keys(templateUpdateData).forEach((updationData) => {
					updateObject['$set'][updationData] = templateUpdateData[updationData]
				})

				updateObject['$set']['updatedBy'] = userId

				let templateUpdatedData = await projectTemplateQueries.findOneAndUpdate(
					{
						_id: templateDocument[0]._id,
					},
					updateObject,
					{ new: true }
				)

				if (!templateUpdatedData._id) {
					throw {
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_UPDATED,
					}
				}

				return resolve({
					success: true,
					data: templateUpdatedData,
					message: CONSTANTS.apiResponses.PROJECT_TEMPLATE_UPDATED,
				})
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * List
	 * @method
	 * @name                        - list
	 * @param {Number} pageNo       - page no.
	 * @param {Number} pageSize     - page size.
	 * @param {String} searchText   - text to search.
	 * @returns {Object}            - project templates list.
	 */

	static list(
		pageNo = '',
		pageSize = '',
		searchText = '',
		currentOrgOnly = false,
		userDetails,
		categoryIds = '',
		groupByCategory = false,
		taskDetails = false
	) {
		return new Promise(async (resolve, reject) => {
			try {
				// Create a query object with the 'isReusable' property set to true.
				let queryObject = { isReusable: true }
				currentOrgOnly = UTILS.convertStringToBoolean(currentOrgOnly)
				groupByCategory = UTILS.convertStringToBoolean(groupByCategory)
				taskDetails = UTILS.convertStringToBoolean(taskDetails)
				queryObject['tenantId'] = userDetails.userInformation.tenantId

				// handle currentOrgOnly filter
				if (currentOrgOnly) {
					let organizationId = userDetails.userInformation.organizationId
					queryObject['orgId'] = { $in: [organizationId] }
				}

				// If 'searchText' is provided, create a search query using '$or'.
				if (searchText !== '') {
					queryObject['$or'] = [
						{ externalId: new RegExp(searchText, 'i') },
						{ title: new RegExp(searchText, 'i') },
						{ description: new RegExp(searchText, 'i') },
					]
				}

				// If 'categoryIds' are provided, add a filter for categories.
				let categoryIdArray

				if (categoryIds && categoryIds !== '') {
					categoryIdArray = categoryIds
						.split(',')
						.map((id) => id.trim())
						.filter((id) => id !== '')
					if (categoryIdArray.length > 0) {
						// Convert category IDs to ObjectIds if needed
						const categoryObjectIds = categoryIdArray.map((id) => {
							const objectId = UTILS.convertStringToObjectId(id) || id
							//requestedCategorySet.add(id);
							return objectId
						})

						// Filter by categories._id to match category objects within the categories array
						queryObject['categories._id'] = { $in: categoryObjectIds }
					}
				}

				// Call the 'templateDocument' function from 'projectTemplateQueries'
				// using the 'queryObject' to fetch templates.
				const templates = await projectTemplateQueries.templateDocument(queryObject)

				// Calculate the indices for pagination.
				const startIndex = (pageNo - 1) * pageSize
				const endIndex = pageNo * pageSize

				// Slice the 'templates' array to get paginated results.
				let paginatedResults = templates.slice(startIndex, endIndex)

				if (taskDetails) {
					for (const template of paginatedResults) {
						// Fetch tasks and subtasks for each template in paginated results
						if (template.tasks && template.tasks.length > 0) {
							template.tasks = await this.tasksAndSubTasks(
								template._id,
								'',
								userDetails.userInformation.tenantId,
								userDetails.userInformation.organizationId
							)
						}
					}
				}

				if (groupByCategory) {
					let groupedTemplates = {}
					paginatedResults.forEach((template) => {
						if (template.categories && template.categories.length > 0) {
							template.categories.forEach((category) => {
								let catId = category._id.toString()

								if (categoryIdArray && categoryIdArray.length > 0) {
									// Check if the current categoryId is in the requestedCategorySet
									if (categoryIdArray.includes(catId)) {
										if (!groupedTemplates[catId]) {
											groupedTemplates[catId] = []
										}
										groupedTemplates[catId].push(template)
									}
								} else {
									if (!groupedTemplates[catId]) {
										groupedTemplates[catId] = []
									}
									groupedTemplates[catId].push(template)
								}
							})
						}
					})
					paginatedResults = groupedTemplates
				}
				// Resolve the promise with success, message, and paginated data.
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_TEMPLATES_FETCHED,
					data: paginatedResults,
				})
			} catch (error) {
				// If an error occurs, resolve the promise with failure and error data.
				return resolve({
					success: false,
					message: error.message,
					data: [],
				})
			}
		})
	}
}

/**
 * Calculate average rating and no of ratings.
 * @method
 * @name _calculateRating
 * @param {Object} ratings - Ratings data.
 * @returns {Object} rating object.
 */

function _calculateRating(ratings) {
	let sum = 0
	let noOfRatings = 0

	Object.keys(ratings).forEach((rating) => {
		sum += rating * ratings[rating]
		noOfRatings += ratings[rating]
	})

	return {
		averageRating: (sum / noOfRatings).toFixed(2),
		noOfRatings: noOfRatings,
	}
}

/**
 * Project information.
 * @method
 * @name _templateInformation
 * @param {Object} project - Project data.
 * @returns {Object} Project information.
 */

function _templateInformation(project) {
	return new Promise(async (resolve, reject) => {
		try {
			if (project.programId) {
				let programs = await programQueries.programsDocument(
					{
						_id: project.programId,
					},
					['name']
				)

				if (!programs.length > 0) {
					throw {
						message: CONSTANTS.apiResponses.PROGRAM_NOT_FOUND,
						status: HTTP_STATUS_CODE.bad_request.status,
					}
				}

				project.programInformation = {
					programId: project.programId,
					programName: programs[0].name,
				}

				delete project.programId
				delete project.programExternalId
			}
			delete project.metaInformation
			delete project.__v

			project.status = project.status ? project.status : CONSTANTS.common.NOT_STARTED_STATUS

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

/**
 * Task and SubTask In Order.
 * @method
 * @name _taskAndSubTaskinSequence
 * @param {Object} query - template Query.
 * @param {String} projectionValue - children or taskSequence.
 * @param {String} language- languageCode
 * @returns {Object} Task and SubTask information.
 */

function _taskAndSubTaskinSequence(query, projectionValue, language = '') {
	return new Promise(async (resolve, reject) => {
		try {
			let tasks = []
			tasks = await projectTemplateTaskQueries.taskDocuments(query, 'all', [
				'projectTemplateId',
				'__v',
				'projectTemplateExternalId',
			])

			for (let task = 0; task < tasks.length; task++) {
				if (language !== '' && tasks[task].translations && tasks[task].translations[language]) {
					tasks[task] = UTILS.getTranslatedData(tasks[task], tasks[task].translations[language])
				}
				tasks[task] = _.omit(tasks[task], 'translations')
				if (tasks[task][projectionValue] && tasks[task][projectionValue].length > 0) {
					let subTaskQuery
					if (projectionValue == CONSTANTS.common.CHILDREN) {
						subTaskQuery = {
							_id: {
								$in: tasks[task][projectionValue],
							},
						}
					} else {
						subTaskQuery = {
							externalId: {
								$in: tasks[task][projectionValue],
							},
						}
					}

					let subTasks = await projectTemplateTaskQueries.taskDocuments(subTaskQuery, 'all', [
						'projectTemplateId',
						'__v',
						'projectTemplateExternalId',
					])

					if (language !== '' && subTasks[0].translations && subTasks[0].translations[language]) {
						subTasks[0] = UTILS.getTranslatedData(subTasks[0], subTasks[0].translations[language])
					}
					subTasks[0] = _.omit(subTasks[0], 'translations')
					tasks[task].children = subTasks
				}
			}

			return resolve(tasks)
		} catch (error) {
			return resolve({
				message: error.message,
				success: false,
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
			})
		}
	})
}
