/**
 * name : programUsers.js
 * description : Program Users service
 * created-date : 19-Jan-2026
 */

const { result } = require('lodash')

const programUsersQueries = require(DB_QUERY_BASE_PATH + '/programUsers')
const userService = require(GENERICS_FILES_PATH + '/services/users')

module.exports = class ProgramUsersService {
	/**
	 * Create or update program user - handles all operations in a single update
	 * @method
	 * @name createOrUpdate
	 * @param {Object} data - request data with all parameters
	 * @returns {Object} result with status and data
	 */
	static async createOrUpdate(data) {
		try {
			const {
				tenantId,
				orgId,
				userId,
				programId,
				programExternalId,
				hierarchy = [],
				entities = [],
				status,
				metaInformation = {},
			} = data

			// Build filter based on available identifiers
			let filterData = {}
			if (userId) {
				filterData.userId = userId
			}
			if (programId) {
				filterData.programId = programId
			} else if (programExternalId) {
				filterData.programExternalId = programExternalId
			}

			// Build update data with all provided parameters
			const updateData = {
				$set: {
					updatedAt: new Date(),
					tenantId,
					orgId,
				},
				$setOnInsert: {
					createdAt: new Date(),
					overview: {},
				},
			}

			// Set base fields if provided
			if (userId) {
				updateData.$set.userId = userId
			}
			if (status) {
				updateData.$set.status = status
			}
			if (programId) {
				updateData.$set.programId = programId
			}
			if (programExternalId) {
				updateData.$set.programExternalId = programExternalId
			}

			// Handle hierarchy: replace if same level exists, else add
			if (hierarchy && hierarchy.length > 0) {
				// For new documents: just set the hierarchy
				updateData.$setOnInsert.hierarchy = hierarchy

				// For existing documents: remove old levels and push new ones
				// Split into two operations if document exists
				if (hierarchy.length > 0) {
					// Store hierarchy for special handling
					updateData._hierarchyReplacement = hierarchy
				}
			} else {
				updateData.$setOnInsert.hierarchy = []
			}

			// Handle entities: set on insert, push on update
			if (entities && entities.length > 0) {
				updateData.$setOnInsert.entities = entities
				// Store entities for special handling in query layer
				updateData._entitiesToPush = entities
			} else {
				updateData.$setOnInsert.entities = []
			}

			// Handle metaInformation: store for query layer to handle separately
			// This includes both user-provided keys and entityDetails to avoid MongoDB conflicts
			const metaInformationToSet = { ...metaInformation }
			updateData._metaInformationToSet = metaInformationToSet

			const result = await programUsersQueries.createOrUpdate(filterData, updateData, {
				upsert: true,
				new: true,
				lean: true,
			})

			// Update overview asynchronously (non-blocking)
			if (result && result._id) {
				setImmediate(async () => {
					this._updateOverviewAsync(result._id)
				})
			}

			delete result.overview // Remove overview from result
			return {
				status: result.createdAt === result.updatedAt ? 201 : 200,
				message: 'Program user created or updated successfully',
				result,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get program user entities with pagination
	 * @method
	 * @name getEntitiesWithPagination
	 * @param {String} userId - user ID
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @param {Number} page - page number
	 * @param {Number} limit - items per page
	 * @param {String} status - status filter
	 * @param {String} searchQuery - search text
	 * @param {String} entityId - specific entity ID to fetch (optional)
	 * @param {Object} userDetails - user details
	 * @param {Object} meta - meta information for filtering
	 * @param {String} sortBy - field to sort by
	 * @param {String} sortOrder - sort order (asc/desc)
	 * @returns {Object} entities with pagination info
	 */
	static async getEntitiesWithPagination(
		userId,
		programId,
		programExternalId,
		page = 1,
		limit = 20,
		status,
		searchQuery = '',
		entityId,
		userDetails,
		meta = {},
		sortBy = 'name',
		sortOrder = 'asc'
	) {
		try {
			const skip = (page - 1) * limit

			// Find document by userId and either programId or programExternalId
			const docData = await this.findByUserAndProgram(userId, programId, programExternalId)

			if (!docData) {
				return {
					status: 404,
					message: 'Program user not found',
					data: [],
				}
			}

			// Get entities from the found document
			let filteredEntities = docData.entities || []

			// Filter by specific entityId if provided
			if (entityId) {
				filteredEntities = filteredEntities.filter(
					(entity) => entity.userId === entityId || entity.entityId === entityId
				)
				if (filteredEntities.length === 0) {
					return {
						status: 200,
						message: 'Entity not found',
						data: { data: [], overview: docData.overview || {} },
						result: { data: [], overview: docData.overview || {} },
					}
				}
			}

			// Filter by status if provided (supports comma-separated values)
			if (status) {
				// Parse comma-separated status values into an array
				const statusArray =
					typeof status === 'string'
						? status
								.split(',')
								.map((s) => s.trim())
								.filter((s) => s.length > 0)
						: [status]

				filteredEntities = filteredEntities.filter((entity) => statusArray.includes(entity.status))
			}

			// Filter by search query if provided
			if (searchQuery) {
				const lowerSearch = searchQuery.toLowerCase()
				filteredEntities = filteredEntities.filter((entity) => {
					// Assuming entity has a 'name' field to search against
					return entity.name && entity.name.toLowerCase().includes(lowerSearch)
				})
			}

			// Apply pagination
			const totalCount = filteredEntities.length
			const paginatedEntities = filteredEntities.slice(skip, skip + limit)

			const userIds = paginatedEntities.map((entity) => entity.userId).filter(Boolean)
			// Fetch user details from user service
			const { success, data } =
				(await userService.accountSearch(
					userIds,
					userDetails.userInformation.tenantId,
					'all',
					[],
					searchQuery,
					page,
					limit,
					meta,
					sortBy,
					sortOrder
				)) || {}

			// Throw error if no valid users returned from service
			if (!success || !data || data.count === 0) {
				return {
					success: true,
					status: 200,
					message: 'No valid users found for the provided entity user IDs.',
					data: { data: [], overview: docData.overview || {} },
					result: { data: [], overview: docData.overview || {} },
				}
			}

			// Map accountSearch data with entity data from docData and filter by searchQuery
			const filteredData = paginatedEntities.map((entity) => {
				const userData = data.data.find((user) => user.id == entity.userId)
				return {
					...entity,
					userDetails: userData || null,
				}
			})

			return {
				status: 200,
				message: 'Entities retrieved successfully',
				data: { data: filteredData, overview: docData.overview || {} },
				result: { data: filteredData, overview: docData.overview || {} },
				count: filteredData.length,
				total: totalCount,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get program user entities with pagination
	 * @method
	 * @name searhProgramUsers
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @param {Array} userIds - array of user IDs
	 * @param {Number} page - page number
	 * @param {Number} limit - items per page
	 * @param {String} status - status filter
	 * @param {String} searchQuery - search text
	 * @param {Object} userDetails - user details
	 * @param {Object} meta - meta information for filtering
	 * @param {String} sortBy - field to sort by
	 * @param {String} sortOrder - sort order (asc/desc)
	 * @returns {Object} entities with pagination info
	 */
	static async searhProgramUsers(
		programId,
		programExternalId,
		userIds = [],
		page = 1,
		limit = 20,
		status,
		searchQuery = '',
		userDetails,
		meta = {},
		sortBy = 'name',
		sortOrder = 'asc'
	) {
		try {
			const skip = (page - 1) * limit

			// Find document by userId and either programId or programExternalId
			const docData = await this.findByUserAndProgram(userId, programId, programExternalId)

			if (!docData) {
				return {
					status: 404,
					message: 'Program user not found',
					data: [],
				}
			}

			// Get entities from the found document
			let filteredEntities = docData.entities || []

			// Filter by specific entityId if provided
			if (entityId) {
				filteredEntities = filteredEntities.filter(
					(entity) => entity.userId === entityId || entity.entityId === entityId
				)
				if (filteredEntities.length === 0) {
					return {
						status: 200,
						message: 'Entity not found',
						data: { data: [], overview: docData.overview || {} },
						result: { data: [], overview: docData.overview || {} },
					}
				}
			}

			// Filter by status if provided (supports comma-separated values)
			if (status) {
				// Parse comma-separated status values into an array
				const statusArray =
					typeof status === 'string'
						? status
								.split(',')
								.map((s) => s.trim())
								.filter((s) => s.length > 0)
						: [status]

				filteredEntities = filteredEntities.filter((entity) => statusArray.includes(entity.status))
			}

			// Filter by search query if provided
			if (searchQuery) {
				const lowerSearch = searchQuery.toLowerCase()
				filteredEntities = filteredEntities.filter((entity) => {
					// Assuming entity has a 'name' field to search against
					return entity.name && entity.name.toLowerCase().includes(lowerSearch)
				})
			}

			// Apply pagination
			const totalCount = filteredEntities.length
			const paginatedEntities = filteredEntities.slice(skip, skip + limit)

			const userIds = paginatedEntities.map((entity) => entity.userId).filter(Boolean)
			// Fetch user details from user service
			const { success, data } =
				(await userService.accountSearch(
					userIds,
					userDetails.userInformation.tenantId,
					'all',
					[],
					searchQuery,
					page,
					limit,
					meta,
					sortBy,
					sortOrder
				)) || {}

			// Throw error if no valid users returned from service
			if (!success || !data || data.count === 0) {
				return {
					success: true,
					status: 200,
					message: 'No valid users found for the provided entity user IDs.',
					data: { data: [], overview: docData.overview || {} },
					result: { data: [], overview: docData.overview || {} },
				}
			}

			// Map accountSearch data with entity data from docData and filter by searchQuery
			const filteredData = paginatedEntities.map((entity) => {
				const userData = data.data.find((user) => user.id == entity.userId)
				return {
					...entity,
					userDetails: userData || null,
				}
			})

			return {
				status: 200,
				message: 'Entities retrieved successfully',
				data: { data: filteredData, overview: docData.overview || {} },
				result: { data: filteredData, overview: docData.overview || {} },
				count: filteredData.length,
				total: totalCount,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get users NOT mapped to a program
	 * @method
	 * @name getUnmappedUsers
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @param {Array} candidateUserIds - array of user IDs to check
	 * @param {Number} page - page number
	 * @param {Number} limit - items per page
	 * @param {String} searchQuery - search text
	 * @param {Object} userDetails - user details
	 * @param {Object} meta - meta information for filtering
	 * @param {String} sortBy - field to sort by
	 * @param {String} sortOrder - sort order (asc/desc)
	 * @returns {Object} unmapped users with pagination info
	 */
	static async getUnmappedUsers(
		programId,
		programExternalId,
		page = 1,
		limit = 20,
		search = '',
		type = 'all',
		userDetails,
		meta = {},
		sortBy = 'name',
		sortOrder = 'asc'
	) {
		try {
			// Step 1: Find all programUsers for this program
			const filterQuery = {}
			if (programId) {
				filterQuery.programId = programId
			} else if (programExternalId) {
				filterQuery.programExternalId = programExternalId
			}

			const allProgramUsers = await programUsersQueries.programUsersDocument(filterQuery, 'all', 'none')

			// Step 2: Extract all mapped user IDs (both managers and entities)
			const mappedUserIds = []

			allProgramUsers.forEach((doc) => {
				// Add the userId (manager/user)
				if (doc.userId) {
					mappedUserIds.push(doc.userId)
				}
				// // Add all entity userIds
				// if (doc.entities && Array.isArray(doc.entities)) {
				// 	doc.entities.forEach(entity => {
				// 		if (entity.userId) {
				// 			mappedUserIds.add(parseInt(entity.userId))
				// 		}
				// 	})
				// }
			})

			// Step 4: Fetch user details from user service
			const { success, data } =
				(await userService.accountSearch(
					[],
					userDetails.userInformation.tenantId,
					type,
					mappedUserIds,
					search,
					page,
					limit,
					meta,
					sortBy,
					sortOrder
				)) || {}

			if (!success || !data || data.count === 0) {
				return {
					success: true,
					status: 200,
					message: 'No valid users found',
					data: { data: [], count: 0 },
					result: { data: [], count: 0 },
				}
			}

			return {
				success: true,
				status: 200,
				message: 'Unmapped users retrieved successfully',
				result: data,
			}
		} catch (error) {
			throw error
		}
	}
	/**
	 * Find program user by userId and either programId or programExternalId
	 * @method
	 * @name findByUserAndProgram
	 * @param {String} userId - user ID
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @returns {Object} program user document
	 */
	static async findByUserAndProgram(userId, programId, programExternalId) {
		try {
			const result = await programUsersQueries.findByUserAndProgram(userId, programId, programExternalId)
			return result
		} catch (error) {
			throw error
		}
	}

	/**
	 * Update specific fields of an entity within a program user
	 * @method
	 * @name updateEntity
	 * @param {String} userId - program user's userId
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @param {String} entityId - entity's userId to identify which entity to update
	 * @param {Object} entityUpdates - fields to update on the entity
	 * @param {String} tenantId - tenant ID
	 * @returns {Object} updated program user document
	 */
	static async updateEntity(userId, programId, programExternalId, entityId, entityUpdates, tenantId) {
		try {
			const result = await programUsersQueries.updateEntity(
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

			return result
		} catch (error) {
			throw error
		}
	}

	/**
	 * Update overview
	 * @method
	 * @name _updateOverviewAsync
	 * @param {Object} programUsersId - Id of userProgram
	 * @returns {Object} result with status and data
	 */
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
}
