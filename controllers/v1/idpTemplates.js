/**
 * name : idpTemplates.js
 * Description : Admin-only APIs to view and edit IDP templates (pathways, pillars and tasks).
 */

const idpTemplatesHelper = require(MODULES_BASE_PATH + '/idpTemplates/helper')

const toError = (error) => ({
	status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
	message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
})

/**
 * IdpTemplates
 * @class
 */
module.exports = class IdpTemplates extends Abstract {
	constructor() {
		super('project-categories')
	}

	static get name() {
		return 'idpTemplates'
	}

	/**
	 * @api {get} /project/v1/idpTemplates/categories
	 * All categories (active and inactive) of the admin's tenant and org.
	 * @apiVersion 1.0.0
	 * @apiGroup IDP Templates
	 * @apiHeader {String} x-auth-token Admin user token
	 * @apiUse successBody
	 * @apiUse errorBody
	 */
	async categories(req) {
		try {
			const result = await idpTemplatesHelper.categories(req.userDetails)
			return { message: result.message, result: result.data }
		} catch (error) {
			throw toError(error)
		}
	}

	/**
	 * @api {post} /project/v1/idpTemplates/updateCategory/:categoryId
	 * Update name, description or status (active/inactive) of a pathway or pillar.
	 * @apiVersion 1.0.0
	 * @apiGroup IDP Templates
	 * @apiHeader {String} x-auth-token Admin user token
	 * @apiParamExample {json} Request:
	 * { "name": "Employment Pathway", "description": "...", "status": "active" }
	 * @apiUse successBody
	 * @apiUse errorBody
	 */
	async updateCategory(req) {
		try {
			const result = await idpTemplatesHelper.updateCategory(req.params._id, req.body, req.userDetails)
			return { message: result.message, result: result.data }
		} catch (error) {
			throw toError(error)
		}
	}

	/**
	 * @api {post} /project/v1/idpTemplates/updateTask/:taskId
	 * Update name or description of a project template task.
	 * @apiVersion 1.0.0
	 * @apiGroup IDP Templates
	 * @apiHeader {String} x-auth-token Admin user token
	 * @apiParamExample {json} Request:
	 * { "name": "Organize the Personal Mastery Training", "description": "..." }
	 * @apiUse successBody
	 * @apiUse errorBody
	 */
	async updateTask(req) {
		try {
			const result = await idpTemplatesHelper.updateTask(req.params._id, req.body, req.userDetails)
			return { message: result.message, result: result.data }
		} catch (error) {
			throw toError(error)
		}
	}

	/**
	 * @api {post} /project/v1/idpTemplates/createTask/:templateId
	 * Add a task at the end of a project template. Only new IDPs get it.
	 * @apiVersion 1.0.0
	 * @apiGroup IDP Templates
	 * @apiHeader {String} x-auth-token Admin user token
	 * @apiParamExample {json} Request:
	 * { "name": "Organize the Digital Skills Training", "description": "...",
	 *   "supportOfferingType": "training", "sessionCategory": "livelihoods" }
	 * @apiUse successBody
	 * @apiUse errorBody
	 */
	async createTask(req) {
		try {
			const result = await idpTemplatesHelper.createTask(req.params._id, req.body, req.userDetails)
			return { message: result.message, result: result.data }
		} catch (error) {
			throw toError(error)
		}
	}

	/**
	 * @api {post} /project/v1/idpTemplates/reorderTasks/:templateId
	 * Save a new order for the tasks of a project template. Only new IDPs follow it.
	 * @apiVersion 1.0.0
	 * @apiGroup IDP Templates
	 * @apiHeader {String} x-auth-token Admin user token
	 * @apiParamExample {json} Request:
	 * { "taskIds": ["69d752ff01a4840014b268b0", "69d752ff01a4840014b268ac"] }
	 * @apiUse successBody
	 * @apiUse errorBody
	 */
	async reorderTasks(req) {
		try {
			const result = await idpTemplatesHelper.reorderTasks(req.params._id, req.body, req.userDetails)
			return { message: result.message, result: result.data }
		} catch (error) {
			throw toError(error)
		}
	}
}
