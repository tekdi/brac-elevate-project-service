/**
 * name : changeRequests.js
 * Description : Change requests service.
 */

// Dependencies
const changeRequestsQueries = require(DB_QUERY_BASE_PATH + '/changeRequests')

/**
 * ChangeRequestsService
 * @class
 */
module.exports = class ChangeRequestsService {
	/**
	 * Find a pending change request for a given target.
	 * @method
	 * @name findPendingForTarget
	 * @param {String} action - PROGRAM_USER_DROPPING_OUT | USER_PROJECT_TEMPLATE_CHANGE.
	 * @param {String} entityId - entity id.
	 * @param {String} projectId - project id (for USER_PROJECT_TEMPLATE_CHANGE, read from changePayload).
	 * @returns {Object} pending change request document, if any.
	 */
	static findPendingForTarget(action, entityId, projectId) {
		return new Promise(async (resolve, reject) => {
			try {
				let filter = {
					action,
					status: 'PENDING',
				}

				if (entityId) filter.entityId = entityId
				if (projectId) filter['changePayload.projectId'] = projectId

				let result = await changeRequestsQueries.findOne(filter)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Create a change request.
	 * @method
	 * @name create
	 * @param {Object} data - change request data.
	 * @returns {Object} created change request document.
	 */
	static create(data) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await changeRequestsQueries.create(data)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * List change requests with pagination and filters.
	 * @method
	 * @name list
	 * @param {Object} filters - { status, action, programId, tenantId, entityId }.
	 * @param {Number} pageNo - page number.
	 * @param {Number} pageSize - page size.
	 * @returns {Object} { data, count }.
	 */
	static list(filters, pageNo, pageSize) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await changeRequestsQueries.list(filters, pageNo, pageSize)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Find change requests for a set of entity ids, unpaginated.
	 * @method
	 * @name findByEntityIds
	 * @param {Array} entityIds - entity ids to look up.
	 * @param {Object} filters - additional filter fields (status, tenantId, programId/programExternalId).
	 * @returns {Array} matching change request documents.
	 */
	static findByEntityIds(entityIds, filters = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				if (!entityIds || !entityIds.length) {
					return resolve([])
				}
				const filterData = { ...filters, entityId: { $in: entityIds } }
				let result = await changeRequestsQueries.findAll(filterData)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Get a change request by id.
	 * @method
	 * @name findById
	 * @param {String} id - change request id.
	 * @returns {Object} change request document.
	 */
	static findById(id) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await changeRequestsQueries.findById(id)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Mark a change request as decided (approved/rejected).
	 * @method
	 * @name decide
	 * @param {String} id - change request id.
	 * @param {String} status - APPROVED | REJECTED.
	 * @param {String} decidedBy - userId of the decision maker.
	 * @param {String} reason - rejection reason (optional).
	 * @returns {Object} updated change request document.
	 */
	static decide(id, status, decidedBy, reason) {
		return new Promise(async (resolve, reject) => {
			try {
				let updateData = {
					status,
					decidedBy,
					decidedAt: new Date(),
				}

				if (reason) updateData.reason = reason

				let result = await changeRequestsQueries.updateById(id, updateData)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}
}
