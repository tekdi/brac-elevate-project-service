/**
 * name : helper.js
 * author : prajwal
 * created-date : 10-Jun-2024
 * Description : Programs users related helper functionality.
 */

// Dependencies
const programUsersQueries = require(DB_QUERY_BASE_PATH + '/programUsers')
const programUsersService = require(SERVICES_BASE_PATH + '/programUsers')
const programQueries = require(DB_QUERY_BASE_PATH + '/programs')
const userService = require(SERVICES_BASE_PATH + '/users')
const entityManagementService = require(SERVICES_BASE_PATH + '/entity-management')

/**
 * ProgramUsersHelper
 * @class
 */
module.exports = class ProgramUsersHelper {
	/**
	 * check if user joined a program or not and consentShared
	 * @methodcreateRecord
	 * @name checkForUserJoinedProgramAndConsentShared
	 * @param {String} programId - Program Id.
	 * @param {String} userId - User Id
	 * @returns {Object} result.
	 */
	static checkForUserJoinedProgramAndConsentShared(programId, userId) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = {}
				const query = {
					userId: userId,
					programId: programId,
				}

				//Check data present in programUsers collection.
				let programUsers = await programUsersQueries.programUsersDocument(query, ['_id', 'consentShared'])
				result.joinProgram = programUsers.length > 0 ? true : false
				result.consentShared = programUsers.length > 0 ? programUsers[0].consentShared : false
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Create or update program user
	 * Handles all operations: create user, add entity, create record, update status
	 * @method
	 * @name createOrUpdate
	 * @param {Object} data - request body data containing all parameters
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} result with status and data
	 */
	static async createOrUpdate(data, userDetails) {
		try {
			const {
				userId,
				programId,
				programExternalId,
				entities,
				hierarchy,
				status,
				metaInformation,
				referenceFrom,
			} = data
			const loggedInUserId = userDetails.userInformation?.userId
			const tenantId = userDetails.userInformation?.tenantId
			const orgId = userDetails.userInformation?.organizationId

			// Validate required fields
			if (!userId || (!programId && !programExternalId)) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'userId and either programId or programExternalId are required',
				}
			}

			// Check if program exists for given programId or programExternalId
			const programExists = await this.checkProgramExists(tenantId, programId, programExternalId)
			if (!programExists) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.not_found.status,
					message: 'Program not found',
				}
			}

			// Validate referenceFrom if provided
			if (referenceFrom) {
				const referenceProgramExists = await this.checkProgramExists(tenantId, referenceFrom, null)
				if (!referenceProgramExists || referenceProgramExists?.isAPrivateProgram) {
					return {
						success: false,
						status: HTTP_STATUS_CODE.not_found.status,
						message: 'Reference program not found OR is a private program',
					}
				}

				servicePayload.referenceFrom = referenceFrom
			}

			// Prepare service payload with all parameters
			const servicePayload = {
				tenantId,
				orgId,
				userId,
				programId,
				programExternalId,
				status,
				metaInformation,
				createdBy: loggedInUserId,
				updatedBy: loggedInUserId,
			}

			// Add entities if provided
			if (entities && entities.length > 0) {
				servicePayload.entities = entities
			}

			// Add hierarchy if provided
			if (hierarchy && Array.isArray(hierarchy) && hierarchy.length > 0) {
				servicePayload.hierarchy = hierarchy
			}

			// Call service with all parameters in single operation
			const result = await programUsersService.createOrUpdate(servicePayload)

			// // Determine activity type for logging
			// let activityType = 'STATUS_CHANGED';
			// if (entity) {
			// 	activityType = 'ENTITY_ADDED';
			// } else if (referenceFrom) {
			// 	activityType = 'RECORD_CREATED';
			// } else if (hierarchy && hierarchy.length > 0) {
			// 	activityType = 'USER_CREATED';
			// }

			// // Log activity asynchronously (non-blocking)
			// this.logActivity(activityType, result.result._id, {
			// 	userId,
			// 	programId,
			// 	...(entity && { entityId: entity.entityId, parentUserId: userId }),
			// 	...(referenceFrom && { parentProgramUsersId: referenceFrom }),
			// 	...(hierarchy && { hierarchyAdded: hierarchy.length }),
			// 	...(status && { newStatus: status })
			// }, loggedInUserId).catch(err => console.error('Activity logging error:', err));

			// // Publish event asynchronously (non-blocking)
			// this.publishEvent(activityType, {
			// 	userId,
			// 	programId,
			// 	...(entity && { entityUserId: entity.userId, entityId: entity.entityId }),
			// 	...(referenceFrom && { parentProgramUsersId: referenceFrom }),
			// 	...(status && { newStatus: status }),
			// 	timestamp: new Date()
			// }).catch(err => console.error('Event publishing error:', err));

			// Update overview asynchronously (non-blocking)
			if (result.result && result.result._id) {
				setImmediate(async () => {
					this._updateOverviewAsync(result.result._id)
				})
			}

			return {
				success: true,
				status: result.status,
				message: result.message,
				data: result.result,
				result: result.result,
			}
		} catch (error) {
			return {
				success: false,
				status: HTTP_STATUS_CODE.internal_server_error.status,
				message: error.message || 'Internal server error',
			}
		}
	}

	/**
	 * Get entities with pagination
	 * @method
	 * @name getEntitiesWithPagination
	 * @param {String} userId - user id
	 * @param {String} programId - program id
	 * @param {String} programExternalId - program external id
	 * @param {Number} page - page number
	 * @param {Number} limit - items per page
	 * @param {String} status - status filter
	 * @param {String} search - search query
	 * @param {String} entityId - entity id
	 * @param {Object} userDetails - user details
	 * @param {Object} meta - meta information for filtering
	 * @param {String} sortBy - field to sort by
	 * @param {String} sortOrder - sort order (asc/desc)
	 * @returns {Object} result
	 */
	static async getEntitiesWithPagination(
		userId,
		programId,
		programExternalId,
		page = 1,
		limit = 20,
		status,
		search = '',
		entityId,
		userDetails,
		meta = {},
		sortBy = 'name',
		sortOrder = 'asc'
	) {
		try {
			// Call service
			const result = await programUsersService.getEntitiesWithPagination(
				userId,
				programId,
				programExternalId,
				page,
				limit,
				status,
				search,
				entityId,
				userDetails,
				meta,
				sortBy,
				sortOrder
			)

			return {
				success: true,
				status: result.status,
				message: result.message,
				data: result.data,
				result: result.data,
				count: result.count,
				total: result.total,
				overview: result.overview,
			}
		} catch (error) {
			return {
				success: false,
				status: HTTP_STATUS_CODE.internal_server_error.status,
				message: error.message || 'Internal server error',
			}
		}
	}

	/**
	 * Find program user
	 * @method
	 * @name findByUserAndProgram
	 * @param {String} userId - user id
	 * @param {String} programId - program id
	 * @param {String} programExternalId - program external id
	 * @returns {Object} program user document
	 */
	static async findByUserAndProgram(userId, programId, programExternalId) {
		try {
			return await programUsersService.findByUserAndProgram(userId, programId, programExternalId)
		} catch (error) {
			throw error
		}
	}

	/**
	 * Log activity to activity collection
	 * @method
	 * @name logActivity
	 * @param {String} activityType - type of activity (CREATE, UPDATE, ADD_ENTITY, etc)
	 * @param {String} programUsersRef - reference to programUsers document ID
	 * @param {Object} activityDetails - details of activity
	 * @param {String} createdBy - user who triggered activity
	 * @returns {Promise} void
	 */
	static async logActivity(activityType, programUsersRef, activityDetails, createdBy) {
		try {
			// Check if activity logging is enabled in config
			const activityConfig = global.config?.activityConfig?.[activityType]

			if (!activityConfig?.enabled) {
				return // Activity logging disabled for this type
			}

			// Create activity log entry
			const activity = {
				programUsersRef,
				activityType,
				activityDetails,
				createdBy,
				createdAt: new Date(),
			}

			// Insert into activity collection
			// Uncomment when programUsersActivities model is available
			// await database.models.programUsersActivities.create(activity);

			console.log('[ProgramUsers Activity]', activityType, activity)
		} catch (error) {
			// Don't throw - activity logging should not block main flow
			console.error('[ProgramUsers Activity Error]', error.message)
		}
	}

	/**
	 * Publish event to Kafka message queue
	 * @method
	 * @name publishEvent
	 * @param {String} eventType - type of event
	 * @param {Object} eventData - event data payload
	 * @returns {Promise} void
	 */
	static async publishEvent(eventType, eventData) {
		try {
			// Get kafka producer from global or environment
			const kafkaProducer = global.kafkaProducer || global.kafkaClient?.producer

			if (!kafkaProducer) {
				console.log('[ProgramUsers Event] Kafka producer not available, skipping event:', eventType)
				return
			}

			// Determine topic from environment or event type
			const topicName = process.env[`PROGRAMUSERS_${eventType}_TOPIC`] || 'program-users-events'

			const kafkaMessage = {
				key: eventData.userId || eventData.programId,
				value: JSON.stringify({
					eventType,
					eventData,
					timestamp: new Date().toISOString(),
					service: 'project-service',
				}),
			}

			// Send to Kafka (implementation depends on kafka client version)
			await kafkaProducer.send({
				topic: topicName,
				messages: [kafkaMessage],
			})

			console.log('[ProgramUsers Event Published]', eventType, 'to', topicName)
		} catch (error) {
			// Don't throw - event publishing should not block main flow
			console.error('[ProgramUsers Event Error]', eventType, error.message)
		}
	}

	/**
	 * Update specific entity fields within a program user
	 * @method
	 * @name updateEntity
	 * @param {Object} data - request body data
	 * @param {String} data.userId - program user's userId
	 * @param {String} data.programId - program ID (optional)
	 * @param {String} data.programExternalId - program external ID (optional)
	 * @param {String} data.entityId - entity's userId to identify which entity to update
	 * @param {Object} data.entityUpdates - fields to update on the entity
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} result with status and updated entity data
	 */
	static async updateEntity(data, userDetails) {
		try {
			const { userId, programId, programExternalId, entityId, entityUpdates } = data
			const tenantId = userDetails.userInformation?.tenantId

			// Validate required fields
			if (!userId || (!programId && !programExternalId)) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'userId and either programId or programExternalId are required',
				}
			}

			if (!entityId) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'entityId is required',
				}
			}

			// Validate entityUpdates - only regular objects are supported (e.g., {status: "ONBOARDED", myList: [{1:1}]})
			if (!entityUpdates) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'entityUpdates is required',
				}
			}

			// Only accept regular objects with named properties
			const isValidObject =
				typeof entityUpdates === 'object' && entityUpdates !== null && Object.keys(entityUpdates).length > 0

			if (!isValidObject) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'entityUpdates must be a non-empty object with named properties',
				}
			}

			// Call service to update entity
			const result = await programUsersService.updateEntity(
				userId,
				programId,
				programExternalId,
				entityId,
				entityUpdates,
				tenantId
			)
			// Update overview asynchronously (non-blocking)
			if (result && result._id) {
				setImmediate(async () => {
					this._updateOverviewAsync(result._id)
				})
			}

			return {
				success: true,
				status: 200,
				message: 'Entity updated successfully',
				result,
			}
		} catch (error) {
			throw error
		}
	}

	static checkProgramExists(tenantId, programId, programExternalId) {
		return new Promise(async (resolve, reject) => {
			try {
				let programMatchQuery = {}
				programMatchQuery['tenantId'] = tenantId

				if (programId) {
					programMatchQuery['_id'] = programId
				} else {
					programMatchQuery['externalId'] = programExternalId
				}

				let programData = await programQueries.programsDocument(programMatchQuery, [
					'name',
					'externalId',
					'isAPrivateProgram',
				])
				if (programData && programData.length > 0) {
					return resolve(programData[0])
				} else {
					return resolve(false)
				}
			} catch (error) {
				return reject(error)
			}
		})
	}

	static async _updateOverviewAsync(programUsersId) {
		// Placeholder for asynchronous overview update logic
		// This could involve recalculating summary statistics or other data
		console.log(`[ProgramUsers] Updating overview for programUsersId: ${programUsersId}`)

		try {
			// Fetch program user document
			const docData = await programUsersQueries.findById(programUsersId)
			if (!docData) {
				console.error('Program user document not found for overview update:', programUsersId)
				return
			}

			const entities = docData.entities || []
			// Count entities by status
			const statusCounts = {
				notonboarded: 0,
				onboarded: 0,
				inprogress: 0,
				completed: 0,
				graduated: 0,
				droppedout: 0,
				total: entities.length,
			}

			entities.forEach((entity) => {
				switch (entity.status) {
					case 'ONBOARDED':
						statusCounts.onboarded++
						break
					case 'NOT_ONBOARDED':
						statusCounts.notonboarded++
						break
					case 'IN_PROGRESS':
						statusCounts.inprogress++
						break
					case 'COMPLETED':
						statusCounts.completed++
						break
					case 'GRADUATED':
						statusCounts.graduated++
						break
					case 'DROPPED_OUT':
						statusCounts.droppedout++
						break
				}
			})

			// Update overview with status counts
			const result = await programUsersQueries
				.updateOverview(programUsersId, {
					$set: {
						'overview.assigned': statusCounts.total,
						'overview.notonboarded': statusCounts.notonboarded,
						'overview.onboarded': statusCounts.onboarded,
						'overview.inprogress': statusCounts.inprogress,
						'overview.completed': statusCounts.completed,
						'overview.graduated': statusCounts.graduated,
						'overview.droppedout': statusCounts.droppedout,
						'overview.lastModified': new Date(),
					},
				})
				.catch((err) => console.error('Overview update error:', err))
		} catch (err) {
			console.error('Error calculating entity counts:', err)
		}
	}

	/**
	 * Assign users with role-based hierarchy
	 * Handles creation of programUsers entries based on role hierarchy
	 * @method
	 * @name assignUsers
	 * @param {Object} bodyData - request body data
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} result with status and data
	 */
	static async assignUsers(bodyData, userDetails) {
		try {
			const {
				userId,
				programId,
				programExternalId,
				assignedUserIds,
				userRolesToEntityTypeMap,
				assignedUsersStatus = 'ACTIVE',
				managerLevel = 0,
				addProgramUsersForAssignedUsers = false,
			} = bodyData
			const loggedInUserId = userDetails.userInformation?.userId
			const tenantId = userDetails.userInformation?.tenantId
			const orgId = userDetails.userInformation?.organizationId
			const managerUserId = userId

			// Validate program exists
			const programExists = await this.checkProgramExists(tenantId, programId, programExternalId)
			if (!programExists) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.not_found.status,
					message: 'Program not found',
				}
			}

			// Use the programId from the found program if programExternalId was provided
			const resolvedProgramId = programId || programExists._id.toString()

			// Fetch manager and assigned users details to get their roles and entity information
			const allUserIds = [managerUserId, ...assignedUserIds]
			const usersResponse = await userService.accountSearch(allUserIds, tenantId)

			if (!usersResponse.success || !usersResponse.data || usersResponse.data.count === 0) {
				throw new Error('User details not found in the user service')
			}

			const usersData = usersResponse.data.data

			// check if the number of users in the usersData is equal to the number of assigned users
			if (usersData.length !== assignedUserIds.length + 1) {
				throw new Error('Either Manager or Some assigned users not found in the user service')
			}

			const results = {
				managerUpdated: null,
				assignedUsersCreated: [],
			}

			// Fetch entity information for assigned users and manager
			assignedUserIds.push(managerUserId)

			const assignedUsersWithEntities = []
			const assignedUsersEntities = await entityManagementService.findEntities(
				tenantId,
				assignedUserIds,
				'metaInformation.externalId'
			)
			if (assignedUsersEntities.success) {
				// Create a Map of externalId -> entity for O(1) lookup
				const entityMap = new Map(
					assignedUsersEntities.data.map((entity) => [parseInt(entity.metaInformation.externalId), entity])
				)

				// Process each user: use existing entity or create new one
				for (const user of usersData) {
					const userId = parseInt(user.id)

					const entity = entityMap.get(userId)

					if (entity && userId !== parseInt(managerUserId)) {
						// User has existing entity
						assignedUsersWithEntities.push({
							userId: entity.metaInformation.externalId,
							name: entity.metaInformation.name,
							entityId: entity._id,
							status: assignedUsersStatus,
						})
					} else if (!entity) {
						// Create entity for user
						let userRoles = user.user_organizations[0].roles.map((role) => role.role.title) || []
						// remove admin role
						userRoles = userRoles.filter((role) => role !== 'admin')
						const entityType = userRolesToEntityTypeMap[userRoles[0]]
						if (entityType) {
							const entityResult = await entityManagementService.addEntity(
								{
									externalId: user.id,
									name: user.name,
								},
								entityType,
								userDetails.userToken,
								tenantId,
								orgId
							)

							if (entityResult.success && userId !== parseInt(managerUserId)) {
								assignedUsersWithEntities.push({
									userId: entityResult.data[0].metaInformation.externalId,
									name: entityResult.data[0].metaInformation.name,
									entityId: entityResult.data[0]._id,
									status: assignedUsersStatus,
								})
							} else {
								throw new Error(`Failed to create entity for user: ${user.name}`)
							}
						}
					}
				}
			} else {
				throw new Error('Failed to fetch entity information for  users')
			}

			// Update manager's programUsers entry with assigned users as entities
			const managerPayload = {
				userId: managerUserId,
				programId: resolvedProgramId,
				programExternalId: programExternalId,
				entities: assignedUsersWithEntities,
				status: 'ACTIVE',
				overview: {
					assigned: assignedUsersWithEntities.length,
				},
			}

			const managerResult = await this.createOrUpdate(managerPayload, userDetails)
			if (managerResult.success) {
				results.managerUpdated = managerResult.result
			} else {
				throw new Error('Failed to update manager programUsers entry')
			}

			if (managerResult.success && assignedUsersWithEntities.length > 0) {
				// Create programUsers entry for each assigned user with hierarchy
				for (const assignedUser of assignedUsersWithEntities) {
					const assignedUserPayload = {
						userId: assignedUser.userId,
						programId: resolvedProgramId,
						programExternalId: programExternalId,
						hierarchy: [
							{
								level: managerLevel,
								id: managerUserId,
							},
						],
						status: assignedUsersStatus,
					}
					if (managerResult.result.hierarchy && managerResult.result.hierarchy.length > 0) {
						for (const hierarchy of managerResult.result.hierarchy) {
							assignedUserPayload.hierarchy.push({
								level: hierarchy.level + 1,
								id: hierarchy.id,
							})
						}
					}

					const assignedUserResult = await this.createOrUpdate(assignedUserPayload, userDetails)
					if (assignedUserResult.success) {
						results.assignedUsersCreated.push(assignedUserResult.result)
					} else {
						throw new Error('Failed to create programUsers entry for assigned user')
					}
				}
			}

			return {
				success: true,
				status: HTTP_STATUS_CODE.ok.status,
				message: 'Users assigned successfully',
				data: results,
				result: results,
			}
		} catch (error) {
			console.error('ProgramUsers assignUsers error:', error)
			return {
				success: false,
				status: HTTP_STATUS_CODE.internal_server_error.status,
				message: error.message || 'Internal server error',
			}
		}
	}

	/**
	 * Check if logged-in user has the participant assigned in programUsers
	 * @method
	 * @name checkParticipantAssigned
	 * @param {String} loggedInUserId - logged in user's userId
	 * @param {String} participantUserId - participant's userId to check
	 * @param {String} participantEntityId - participant's entityId to check
	 * @param {String} tenantId - tenant ID
	 * @returns {Promise<Object>} result with success status and programUsers document if found
	 */
	static async checkifEntityAssigned(loggedInUserId, entityId, programId, tenantId) {
		try {
			const myDoc = await programUsersService.findByUserAndProgram(loggedInUserId, programId, null, tenantId)

			if (!myDoc) {
				return {
					success: false,
					message: 'Logged in User is not assigned to program',
				}
			}
			const myEntities = await programUsersService.getMyEntities(loggedInUserId, programId, tenantId)
			if (myEntities.length > 0) {
				const myEntity = myEntities.find((entity) => entity.userId === entityId)
				if (myEntity) {
					return {
						success: true,
						programUserDoc: myDoc,
						entity: myEntity,
					}
				}
			}
			return {
				success: false,
				message: 'Entity is not mapped to the logged in user in the program',
			}
		} catch (error) {
			console.error('Error checking participant assignment:', error)
			return {
				success: false,
				message: error.message || 'Error checking participant assignment',
			}
		}
	}

	/**
	 * Update entity location/profile information
	 * Similar to user/update but validates that logged-in user has participant assigned
	 * @method
	 * @name updateEntityProfile
	 * @param {Object} data - request body data
	 * @param {String} data.userId - participant's userId to update
	 * @param {String} data.entityId - participant's entityId (optional, can use userId)
	 * @param {Object} data.updateData - profile data to update (province, site, address, etc.)
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} result with status and updated user data
	 */
	static async updateEntityProfile(data, userDetails) {
		try {
			const { entityId, programId, updateData } = data
			const loggedInUserId = userDetails.userInformation?.userId
			const tenantId = userDetails.userInformation?.tenantId
			const orgId = userDetails.userInformation?.organizationId
			const userToken = userDetails.userToken

			// Validate required fields
			if (!loggedInUserId || !programId || !entityId) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'userId and programId and entityId are required',
				}
			}

			if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'updateData is required and must be a non-empty object',
				}
			}

			// Check if logged-in user has this participant assigned
			const assignmentCheck = await this.checkifEntityAssigned(loggedInUserId, entityId, programId, tenantId)
			if (!assignmentCheck.success) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.forbidden.status,
					message: assignmentCheck.message || 'You do not have permission to update this participant',
				}
			}

			// Call user service to update the participant's profile using org-admin endpoint
			const updateResult = await userService.updateProfile(
				assignmentCheck.entity.userId,
				updateData,
				userToken,
				tenantId,
				orgId
			)

			if (!updateResult.success) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: updateResult.message || 'Failed to update participant profile',
					error: updateResult.error,
				}
			}

			return {
				success: true,
				status: HTTP_STATUS_CODE.ok.status,
				message: 'Participant profile updated successfully',
				result: updateResult.data,
			}
		} catch (error) {
			console.error('Error updating participant location:', error)
			return {
				success: false,
				status: HTTP_STATUS_CODE.internal_server_error.status,
				message: error.message || 'Internal server error',
			}
		}
	}
}
