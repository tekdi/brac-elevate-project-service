/**
 * name : programUsers.js
 * author : Ankit Shahu
 * created-date : 07-04-2023
 * Description : program users helper for DB interactions.
 */
module.exports = class programUsers {
	/**
	 * program users details.
	 * @method
	 * @name programUsersDocument
	 * @param {Array} [filterData = "all"] - program users filter query.
	 * @param {Array} [fieldsArray = "all"] - projected fields.
	 * @param {Array} [skipFields = "none"] - field not to include
	 * @returns {Array} program users details.
	 */

	static programUsersDocument(filterData = 'all', fieldsArray = 'all', skipFields = 'none') {
		return new Promise(async (resolve, reject) => {
			try {
				let queryObject = filterData != 'all' ? filterData : {}
				let projection = {}

				if (fieldsArray != 'all') {
					fieldsArray.forEach((field) => {
						projection[field] = 1
					})
				}

				if (skipFields !== 'none') {
					skipFields.forEach((field) => {
						projection[field] = 0
					})
				}

				let programJoinedData = await database.models.programUsers.find(queryObject, projection).lean()
				return resolve(programJoinedData)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Create or update program user record
	 * @method
	 * @name createOrUpdate
	 * @param {Object} filterData - filter criteria
	 * @param {Object} updateData - data to update/insert
	 * @param {Object} options - update options (upsert, new, etc)
	 * @returns {Object} program user document
	 */
	static createOrUpdate(filterData, updateData, options = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				const defaultOptions = {
					upsert: true,
					new: true,
					setDefaultsOnInsert: true,
					lean: true,
				}

				const finalOptions = { ...defaultOptions, ...options }

				// Check if we need to handle hierarchy replacement (for existing documents)
				const hierarchyReplacement = updateData._hierarchyReplacement
				delete updateData._hierarchyReplacement

				// Check if we need to push entities (for existing documents)
				const entitiesToPush = updateData._entitiesToPush
				delete updateData._entitiesToPush

				// Check if we need to set metaInformation
				const metaInformationToSet = updateData._metaInformationToSet
				delete updateData._metaInformationToSet

				let result = await database.models.programUsers.findOneAndUpdate(filterData, updateData, finalOptions)

				// If metaInformation needs to be set, do it separately
				if (metaInformationToSet && result && result._id) {
					result = await database.models.programUsers.findOneAndUpdate(
						{ _id: result._id },
						{
							$set: { metaInformation: metaInformationToSet, updatedAt: new Date() },
						},
						{ new: true, lean: true }
					)
				}

				// If entities need to be pushed and document exists, do push separately
				if (entitiesToPush && result && result._id) {
					// Fetch existing entities to check for duplicates
					const existingDoc = await database.models.programUsers.findById(result._id, { entities: 1 }).lean()
					const existingEntities = existingDoc?.entities || []
					const existingUserIds = new Set(existingEntities.map((e) => e.userId))

					// Separate new entities from updates
					const newEntities = []
					const entitiesToUpdate = []

					entitiesToPush.forEach((entity) => {
						if (existingUserIds.has(entity.userId)) {
							entitiesToUpdate.push(entity)
						} else {
							newEntities.push(entity)
						}
					})

					// Update existing entities
					for (const entity of entitiesToUpdate) {
						await database.models.programUsers.findOneAndUpdate(
							{ _id: result._id, 'entities.userId': entity.userId },
							{
								$set: {
									'entities.$': entity,
									updatedAt: new Date(),
								},
							},
							{ new: true, lean: true }
						)
					}

					// Push only new entities
					if (newEntities.length > 0) {
						result = await database.models.programUsers.findOneAndUpdate(
							{ _id: result._id },
							{
								$push: { entities: { $each: newEntities } },
								$set: { updatedAt: new Date() },
							},
							{ new: true, lean: true }
						)
					}
				}

				// If hierarchy replacement is needed and document exists, do two separate updates
				if (hierarchyReplacement && result && result._id) {
					// First: Remove old entries at matching levels
					const pullCondition = {
						$or: hierarchyReplacement.map((item) => ({ level: item.level })),
					}

					await database.models.programUsers.findOneAndUpdate(
						{ _id: result._id },
						{
							$pull: { hierarchy: pullCondition },
							$set: { updatedAt: new Date() },
						},
						{ new: true, lean: true }
					)

					// Second: Add new hierarchy items
					result = await database.models.programUsers.findOneAndUpdate(
						{ _id: result._id },
						{
							$push: { hierarchy: { $each: hierarchyReplacement } },
							$set: { updatedAt: new Date() },
						},
						{ new: true, lean: true }
					)
				}

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Add entity to entities array
	 * @method
	 * @name addEntity
	 * @param {String} docId - document _id
	 * @param {Object} entity - entity object to add
	 * @returns {Object} updated document
	 */
	static addEntity(docId, entity) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.programUsers.findByIdAndUpdate(
					docId,
					{
						$push: { entities: entity },
						$set: {
							updatedAt: new Date(),
							'overview.assigned': {
								$cond: [
									{ $eq: ['$overview.assigned', undefined] },
									1,
									{ $add: ['$overview.assigned', 1] },
								],
							},
						},
					},
					{ new: true, lean: true }
				)

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Update overview statistics
	 * @method
	 * @name updateOverview
	 * @param {String} docId - document _id
	 * @param {Object} updateOperations - increment/decrement operations
	 * @returns {Object} updated document
	 */
	static updateOverview(docId, updateOperations) {
		return new Promise(async (resolve, reject) => {
			try {
				const updateObj = { $set: { 'overview.lastRecalculated': new Date() } }

				if (updateOperations.$inc) {
					updateObj.$inc = updateOperations.$inc
				}
				if (updateOperations.$set) {
					updateObj.$set = { ...updateObj.$set, ...updateOperations.$set }
				}

				let result = await database.models.programUsers.findByIdAndUpdate(docId, updateObj, {
					new: true,
					lean: true,
				})

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Get document with entities and pagination
	 * @method
	 * @name getDocumentWithEntities
	 * @param {String} docId - document _id
	 * @param {Number} skip - skip count for pagination
	 * @param {Number} limit - limit for pagination
	 * @param {String} searchQuery - search text
	 * @returns {Object} document with entities
	 */
	static getDocumentWithEntities(docId, skip = 0, limit = 20, searchQuery = '') {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.programUsers
					.findById(docId, {
						entities: 1,
						overview: 1,
						userId: 1,
						programId: 1,
					})
					.lean()

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
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
	static findByUserAndProgram(userId, programId, programExternalId) {
		return new Promise(async (resolve, reject) => {
			try {
				// Build query: use programId if available, otherwise programExternalId
				const query = { userId }
				if (programId) {
					query.programId = programId
				} else if (programExternalId) {
					query.programExternalId = programExternalId
				}

				let result = await database.models.programUsers.findOne(query).lean()

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
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
	static findById(docId) {
		return new Promise(async (resolve, reject) => {
			try {
				// Build query: use programId if available, otherwise programExternalId
				const query = { _id: docId }

				let result = await database.models.programUsers.findOne(query).lean()

				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 *
	 * Update specific fields of an entity within a program user
	 * @method
	 * @name updateEntity
	 * @param {String} userId - program user's userId
	 * @param {String} programId - program ID (optional)
	 * @param {String} programExternalId - program external ID (optional)
	 * @param {String} entityId - entity's userId to identify which entity to update
	 * @param {Object|Array} entityUpdates - fields to update on the entity (object or array of objects)
	 * @param {String} tenantId - tenant ID
	 * @returns {Object} updated program user document
	 */
	static updateEntity(userId, programId, programExternalId, entityId, entityUpdates, tenantId) {
		return new Promise(async (resolve, reject) => {
			try {
				// Build query: use programId if available, otherwise programExternalId
				const query = { userId: userId.toString(), tenantId: tenantId }
				if (programId) {
					query.programId = programId
				} else if (programExternalId) {
					query.programExternalId = programExternalId
				}

				// Only support regular objects like {status: "ONBOARDED", myList: [{1:1}]}
				// Handle edge case: if array was converted to object with numeric keys (e.g., {0: {...}})
				let updates = entityUpdates

				if (typeof entityUpdates !== 'object' || entityUpdates === null) {
					return reject({
						message: 'entityUpdates must be an object',
						status: 400,
					})
				}

				// Build the $set operations with dot notation for nested fields
				const setOperations = { updatedAt: new Date() }
				Object.keys(updates).forEach((key) => {
					// if key name is having Id as suffix then and values is not mongoObjectId if then add object id to the value
					if ((key.endsWith('Id') || key.endsWith('id')) && updates[key]) {
						updates[key] = UTILS.convertStringToObjectId(updates[key])
					}

					// Only process non-numeric keys (regular object properties)
					if (!/^\d+$/.test(key)) {
						setOperations[`entities.$.${key}`] = updates[key]
					}
				})

				// First, find the document to verify it exists and find which field matches the entity
				const docData = await database.models.programUsers.findOne(query).lean()

				if (!docData) {
					return reject({
						message: 'Program user not found',
						status: 404,
					})
				}

				// Find the entity and determine which field matches
				const entity = docData.entities?.find(
					(e) => e.userId == entityId || e.externalId == entityId || e.entityId == entityId
				)

				if (!entity) {
					return reject({
						message: 'Entity not found in program user',
						status: 404,
					})
				}

				// Determine which field to use for matching (priority: userId > entityId > externalId)
				let matchField = 'entities.userId'
				if (entity.userId == entityId) {
					matchField = 'entities.userId'
				} else if (entity.entityId == entityId) {
					matchField = 'entities.entityId'
				} else if (entity.externalId == entityId) {
					matchField = 'entities.externalId'
				}

				// Build the query with the specific matching field
				// The positional operator requires the array matching condition to be directly in the query
				const updateQuery = { ...query }
				updateQuery[matchField] = entityId.toString()

				// Perform the update
				const result = await database.models.programUsers.findOneAndUpdate(
					updateQuery,
					{
						$set: setOperations,
					},
					{ new: true, lean: true }
				)

				if (!result) {
					return reject({
						message: 'Failed to update entity',
						status: 500,
						details: {
							updateQuery,
							setOperations,
							entityId,
							matchField,
						},
					})
				}

				return resolve(result)
			} catch (error) {
				console.error('updateEntity - Exception caught:', {
					error: error.message || error,
					stack: error.stack,
					userId,
					programId,
					programExternalId,
					entityId,
					entityUpdates: JSON.stringify(entityUpdates),
				})
				return reject(error)
			}
		})
	}
}
