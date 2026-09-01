/**
 * name : changeRequests.js
 * Description : Supervisor-approval change requests controller.
 */

const changeRequestsHelper = require(MODULES_BASE_PATH + '/changeRequests/helper')

/**
 * ChangeRequests
 * @class
 */
module.exports = class ChangeRequests extends Abstract {
	constructor() {
		super('changeRequests')
	}

	static get name() {
		return 'changeRequests'
	}

	async requestChange(req) {
		return new Promise(async (resolve, reject) => {
			try {
				const result = await changeRequestsHelper.requestChange(req)

				if (!result.success) {
					throw {
						status: result.status,
						message: result.message,
					}
				}

				return resolve(result)
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}
	/**
	 * List change requests (paginated, filterable). Supervisors see requests
	 * assigned to them by default.
	 * @method
	 * @name list
	 * @param {Object} req - request object
	 * @returns {Object} paginated list of change requests
	 */
	async list(req) {
		return new Promise(async (resolve, reject) => {
			try {
				const result = await changeRequestsHelper.list(req)
				return resolve({
					status: result.status,
					message: result.message,
					data: result.data,
					result: result.result,
					count: result.count,
				})
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}

	/**
	 * Approve or reject a pending change request.
	 * @method
	 * @name decision
	 * @param {Object} req - request object
	 * @returns {Object} decision result
	 */
	async decision(req) {
		return new Promise(async (resolve, reject) => {
			try {
				const result = await changeRequestsHelper.decision(req)

				if (!result.success) {
					throw {
						status: result.status,
						message: result.message,
					}
				}

				return resolve({
					status: result.status,
					message: result.message,
					result: result.result,
				})
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}

	/**
	 * Resolve the supervisor (hierarchy level 0) for a user within a program.
	 * Internal-access-token protected - intended for cross-service calls
	 * (e.g. brac-elevate-mentoring resolving an LC's supervisor).
	 * @method
	 * @name resolveSupervisor
	 * @param {Object} req - request object
	 * @param {String} req.body.userId - user id to resolve the supervisor for.
	 * @param {String} [req.body.programId] - program id.
	 * @param {String} [req.body.programExternalId] - program external id.
	 * @param {String} req.body.tenantId - tenant id.
	 * @returns {Object} { supervisorId }
	 */
	async resolveSupervisor(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let validationError = req.validationErrors()
				if (validationError.length) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: validationError,
					}
				}

				const { userId, programId, programExternalId, tenantId } = req.body

				const supervisorId = await changeRequestsHelper.resolveSupervisor(
					userId,
					programId,
					programExternalId,
					tenantId
				)

				return resolve({
					status: HTTP_STATUS_CODE.ok.status,
					message: 'Supervisor resolved successfully',
					result: { supervisorId },
				})
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || 'Internal server error',
				})
			}
		})
	}
}
