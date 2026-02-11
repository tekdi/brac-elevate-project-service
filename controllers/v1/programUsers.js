/**
 * name : programUsers.js
 * author : Ankit Shahu
 * created-date : 9-Jan-2023
 * Description : Program Users related controller.
 */

const programUsersHelper = require(MODULES_BASE_PATH + '/programUsers/helper')
const programUsersService = require(SERVICES_BASE_PATH + '/programUsers')
/**
 * programUsers
 * @class
 */
module.exports = class ProgramUsers extends Abstract {
	constructor() {
		super('programUsers')
	}

	static get name() {
		return 'programUsers'
	}

	/**
	 * Create or update program user
	 * Supports: create, update, add entity, update status
	 * Routes to updateEntity if entityId and entityUpdates are provided
	 * @method
	 * @name createOrUpdate
	 * @param {Object} req - request object
	 * @returns {Object} response with status and result
	 */
	async createOrUpdate(req) {
		return new Promise(async (resolve, reject) => {
			try {
				if (
					!req.body.userId &&
					req.userDetails &&
					req.userDetails.userInformation &&
					req.userDetails.userInformation.userId
				) {
					req.body.userId = req.userDetails.userInformation.userId
				}
				// Check if this is an entity-specific update
				if (req.body.entityId && req.body.entityUpdates) {
					const result = await programUsersHelper.updateEntity(req.body, req.userDetails)
					return resolve(result)
				}

				if (req.body.userId && req.body.assignedUserIds) {
					const result = await programUsersHelper.assignUsers(req.body, req.userDetails)
					return resolve(result)
				}

				// Regular createOrUpdate flow
				const result = await programUsersHelper.createOrUpdate(req.body, req.userDetails)

				return resolve(result)
			} catch (error) {
				return reject({
					status: HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}

	/**
	 * Get entities from a program user with pagination and search
	 * @method
	 * @name getEntities
	 * @param {Object} req - request object
	 * @returns {Object} paginated list of entities
	 */
	async entities(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let { userId, programId, programExternalId, status, search = '', entityId = '' } = req.query
				const { pageNo = 1, pageSize = 20 } = req
				const meta = req.body && req.body.meta ? req.body.meta : {}

				if (
					!userId &&
					req.userDetails &&
					req.userDetails.userInformation &&
					req.userDetails.userInformation.userId
				) {
					userId = req.userDetails.userInformation.userId
				}

				if (!userId || (!programId && !programExternalId)) {
					return reject({
						status: HTTP_STATUS_CODE.bad_request.status,
						message: 'userId and either programId or programExternalId are required',
					})
				}
				// Call helper
				const result = await programUsersHelper.getEntitiesWithPagination(
					userId,
					programId,
					programExternalId,
					parseInt(pageNo),
					parseInt(pageSize),
					status,
					search,
					entityId,
					req.userDetails,
					meta
				)
				return resolve(result)
			} catch (error) {
				return reject({
					status: HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}

	/**
	 * Get entities from a program user with pagination and search
	 * @method
	 * @name search
	 * @param {Object} req - request object
	 * @returns {Object} paginated list of entities
	 */
	async search(req) {
		return new Promise(async (resolve, reject) => {
			try {
				const {
					programId,
					programExternalId,
					status,
					type = 'all',
					search = '',
					excludeMapped = false,
					userIds = [],
				} = req.query
				const { pageNo = 1, pageSize = 20 } = req
				const meta = req.body && req.body.meta ? req.body.meta : {}

				if (!programId && !programExternalId) {
					return reject({
						status: HTTP_STATUS_CODE.bad_request.status,
						message: 'Either programId or programExternalId is required',
					})
				}

				// If excludeMapped is true, get unmapped users
				if (excludeMapped === 'true' || excludeMapped === true) {
					const result = await programUsersService.getUnmappedUsers(
						programId,
						programExternalId,
						parseInt(pageNo),
						parseInt(pageSize),
						search,
						type,
						req.userDetails,
						meta
					)
					return resolve(result)
				}

				// Original behavior: get mapped users
				const result = await programUsersService.searhProgramUsers(
					programId,
					programExternalId,
					userIds,
					parseInt(pageNo),
					parseInt(pageSize),
					status,
					search,
					req.userDetails,
					meta
				)
				return resolve(result)
			} catch (error) {
				return reject({
					status: HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}
}
