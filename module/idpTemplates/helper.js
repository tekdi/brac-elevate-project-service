/**
 * name : helper.js
 * Description : Admin view and edit of IDP templates.
 * An IDP template is a pathway category; its pillars are child categories and its tasks are
 * project template tasks. Edits change only the template data, so IDPs that participants
 * already have (projects) keep their copied names; only new IDPs pick up the changes.
 */

const projectCategoriesQueries = require(DB_QUERY_BASE_PATH + '/projectCategories')
const projectTemplateTaskQueries = require(DB_QUERY_BASE_PATH + '/projectTemplateTask')
const projectTemplateQueries = require(DB_QUERY_BASE_PATH + '/projectTemplates')

const CATEGORY_EDITABLE_FIELDS = ['name', 'description', 'status']
const TASK_EDITABLE_FIELDS = ['name', 'description']
const CATEGORY_SKIP_FIELDS = ['__v', 'evidences', 'translations']
// support_offering_type values that make a task schedulable in the LC's IDP ('' = plain task)
const TASK_SUPPORT_TYPES = ['', 'training', 'additional_service', 'asset']
// session_category values used by existing session tasks
const TASK_SESSION_CATEGORIES = ['', 'social_empowerment', 'financial_inclusion', 'livelihoods']

const badRequest = (message) => ({ status: HTTP_STATUS_CODE.bad_request.status, message })

const assertAdmin = (userDetails) => {
	const roles = userDetails?.userInformation?.roles || []
	if (!roles.includes(CONSTANTS.common.ADMIN_ROLE)) {
		throw {
			status: HTTP_STATUS_CODE.forbidden.status,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_ADMIN_ONLY,
		}
	}
}

const getTenantAndOrg = (userDetails) => ({
	tenantId: userDetails.userInformation.tenantId,
	orgId: userDetails.userInformation.organizationId,
})

// Keeps only the allowed fields; trims strings and validates name and status
const pickEditableFields = (body = {}, allowedFields) => {
	const data = {}
	allowedFields.forEach((field) => {
		if (body[field] === undefined) return
		data[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
	})

	if (Object.keys(data).length === 0) {
		throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_NOTHING_TO_UPDATE)
	}
	if (data.name !== undefined && (typeof data.name !== 'string' || data.name === '')) {
		throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_NAME_REQUIRED)
	}
	if (data.description !== undefined && typeof data.description !== 'string') {
		throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_NOTHING_TO_UPDATE)
	}
	// CONSTANTS is a global set after controllers load, so read it at call time, not at file load
	const categoryStatuses = [CONSTANTS.common.ACTIVE_STATUS, CONSTANTS.common.INACTIVE]
	if (data.status !== undefined && !categoryStatuses.includes(data.status)) {
		throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_STATUS)
	}
	return data
}

/**
 * Next task externalId following the template's own pattern: FI_TASK_1..3 -> FI_TASK_4.
 * Uses the prefix of the template's numbered tasks and the highest number + 1, skipping ids
 * already used in the tenant. Falls back to <TEMPLATE_EXTERNAL_ID>_TASK_<n> for a template without them.
 */
const getNextTaskExternalId = async (template, tenantId) => {
	const tasks = (template.tasks || []).length
		? await projectTemplateTaskQueries.taskDocuments({ _id: { $in: template.tasks }, tenantId }, ['externalId'])
		: []

	const numbered = tasks
		.map((task) => /^(.*?)(\d+)$/.exec(task.externalId || ''))
		.filter(Boolean)
		.map(([, prefix, number]) => ({ prefix, number: Number(number) }))

	// Most used prefix in the template (e.g. FI_TASK_), so a one-off id does not change the pattern
	const prefixCounts = numbered.reduce(
		(counts, { prefix }) => ({ ...counts, [prefix]: (counts[prefix] || 0) + 1 }),
		{}
	)
	const prefix =
		Object.keys(prefixCounts).sort((a, b) => prefixCounts[b] - prefixCounts[a])[0] || `${template.externalId}_TASK_`
	let next = Math.max(0, ...numbered.filter((item) => item.prefix === prefix).map((item) => item.number)) + 1

	// externalId is unique per tenant, so skip any number already taken
	while (
		(await projectTemplateTaskQueries.taskDocuments({ externalId: `${prefix}${next}`, tenantId }, ['_id'])).length
	) {
		next++
	}
	return `${prefix}${next}`
}

module.exports = class IdpTemplatesHelper {
	/**
	 * All categories of the caller's tenant and org, active and inactive (not deleted),
	 * so admin can still see and re-activate an inactive pathway or pillar.
	 * @method
	 * @name categories
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} categories list
	 */
	static async categories(userDetails) {
		assertAdmin(userDetails)
		const { tenantId, orgId } = getTenantAndOrg(userDetails)

		const categories = await projectCategoriesQueries.categoryDocuments(
			{
				tenantId,
				visibleToOrganizations: { $in: [orgId] },
				isDeleted: false,
			},
			'all',
			CATEGORY_SKIP_FIELDS
		)

		return {
			success: true,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_CATEGORIES_FETCHED,
			data: categories,
		}
	}

	/**
	 * Update name, description or status of a pathway or pillar category.
	 * @method
	 * @name updateCategory
	 * @param {String} categoryId - category _id
	 * @param {Object} body - fields to update
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} updated category
	 */
	static async updateCategory(categoryId, body, userDetails) {
		assertAdmin(userDetails)
		if (!UTILS.isValidMongoId(categoryId)) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_ID)
		}

		const updateData = pickEditableFields(body, CATEGORY_EDITABLE_FIELDS)
		const { tenantId, orgId } = getTenantAndOrg(userDetails)
		const findQuery = {
			_id: categoryId,
			tenantId,
			visibleToOrganizations: { $in: [orgId] },
			isDeleted: false,
		}

		const existing = await projectCategoriesQueries.categoryDocuments(findQuery, ['_id'])
		if (!existing.length) {
			throw badRequest(CONSTANTS.apiResponses.CATEGORY_NOT_FOUND)
		}

		await projectCategoriesQueries.updateMany(
			{ _id: categoryId, tenantId },
			{ $set: { ...updateData, updatedBy: userDetails.userInformation.userId } }
		)

		const [updated] = await projectCategoriesQueries.categoryDocuments(findQuery, 'all', CATEGORY_SKIP_FIELDS)

		return {
			success: true,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_CATEGORY_UPDATED,
			data: updated,
		}
	}

	/**
	 * Update name or description of a project template task.
	 * @method
	 * @name updateTask
	 * @param {String} taskId - task _id
	 * @param {Object} body - fields to update
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} updated task
	 */
	static async updateTask(taskId, body, userDetails) {
		assertAdmin(userDetails)
		if (!UTILS.isValidMongoId(taskId)) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_ID)
		}

		const updateData = pickEditableFields(body, TASK_EDITABLE_FIELDS)
		const { tenantId } = getTenantAndOrg(userDetails)

		const existing = await projectTemplateTaskQueries.taskDocuments({ _id: taskId, tenantId, isDeleted: false }, [
			'_id',
		])
		if (!existing.length) {
			throw badRequest(CONSTANTS.apiResponses.PROJECT_TEMPLATE_TASKS_NOT_FOUND)
		}

		const updated = await projectTemplateTaskQueries.findOneAndUpdate(
			{ _id: taskId, tenantId },
			{ $set: { ...updateData, updatedBy: userDetails.userInformation.userId } },
			{ new: true, projection: { _id: 1, externalId: 1, name: 1, description: 1, updatedAt: 1, updatedBy: 1 } }
		)

		return {
			success: true,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_TASK_UPDATED,
			data: updated,
		}
	}

	/**
	 * Add a new task at the end of a project template. Only new IDPs get it.
	 * @method
	 * @name createTask
	 * @param {String} templateId - project template _id
	 * @param {Object} body - name, description, supportOfferingType, sessionCategory
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} created task
	 */
	static async createTask(templateId, body = {}, userDetails) {
		assertAdmin(userDetails)
		if (!UTILS.isValidMongoId(templateId)) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_ID)
		}

		const name = typeof body.name === 'string' ? body.name.trim() : ''
		const description = typeof body.description === 'string' ? body.description.trim() : ''
		const supportOfferingType = body.supportOfferingType || ''
		const sessionCategory = body.sessionCategory || ''
		if (!name) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_NAME_REQUIRED)
		}
		if (!TASK_SUPPORT_TYPES.includes(supportOfferingType)) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_TASK_TYPE)
		}
		if (!TASK_SESSION_CATEGORIES.includes(sessionCategory)) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_SESSION_CATEGORY)
		}

		const { tenantId } = getTenantAndOrg(userDetails)
		const userId = userDetails.userInformation.userId
		const [template] = await projectTemplateQueries.templateDocument(
			{ _id: templateId, tenantId, isDeleted: false },
			['_id', 'externalId', 'orgId', 'tasks']
		)
		if (!template) {
			throw badRequest(CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND)
		}

		// const externalId = `${template.externalId}-TASK-${Date.now().toString(36)}`
		const externalId = await getNextTaskExternalId(template, tenantId)
		// Same metaInformation shape as the tasks loaded from CSV; a support type makes it schedulable
		const metaInformation = {
			hasAParentTask: 'NO',
			parentTaskOperator: '',
			parentTaskValue: '',
			parentTaskId: '',
			isAnExternalTask: '',
			minNoOfSubmissionsRequired: '',
			redirectLink: '',
			buttonLabel: supportOfferingType ? 'Schedule' : '',
			icon: supportOfferingType ? 'lucide-calendar' : '',
			...(supportOfferingType ? { support_offering_type: supportOfferingType } : {}),
			...(sessionCategory ? { session_category: sessionCategory } : {}),
		}

		const task = await projectTemplateTaskQueries.createTemplateTask({
			type: 'simple',
			name,
			description: description || name,
			externalId,
			projectTemplateId: template._id,
			projectTemplateExternalId: template.externalId,
			sequenceNumber: String((template.tasks || []).length + 1),
			metaInformation,
			isDeletable: false,
			isDeleted: false,
			deleted: false,
			hasSubTasks: false,
			children: [],
			taskSequence: [],
			visibleIf: [],
			learningResources: [],
			tenantId,
			orgId: template.orgId,
			createdBy: userId,
			updatedBy: userId,
		})

		// Add it at the end of the template so new IDPs include it
		await projectTemplateQueries.findOneAndUpdate(
			{ _id: template._id, tenantId },
			{ $push: { tasks: task._id, taskSequence: externalId }, $set: { updatedBy: userId } }
		)

		return {
			success: true,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_TASK_CREATED,
			data: { _id: task._id, externalId, name: task.name, description: task.description, metaInformation },
		}
	}

	/**
	 * Save a new order for the tasks of a project template. New IDPs follow taskSequence,
	 * and the admin screen sorts by sequenceNumber, so both are updated.
	 * @method
	 * @name reorderTasks
	 * @param {String} templateId - project template _id
	 * @param {Object} body - { taskIds: [task _id in the new order] }
	 * @param {Object} userDetails - logged in user details
	 * @returns {Object} new order
	 */
	static async reorderTasks(templateId, body = {}, userDetails) {
		assertAdmin(userDetails)
		const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(String) : []
		if (!UTILS.isValidMongoId(templateId) || !taskIds.length || !taskIds.every((id) => UTILS.isValidMongoId(id))) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_INVALID_ID)
		}

		const { tenantId } = getTenantAndOrg(userDetails)
		const userId = userDetails.userInformation.userId
		const [template] = await projectTemplateQueries.templateDocument(
			{ _id: templateId, tenantId, isDeleted: false },
			['_id', 'tasks', 'taskSequence']
		)
		if (!template) {
			throw badRequest(CONSTANTS.apiResponses.PROJECT_TEMPLATE_NOT_FOUND)
		}

		const activeTasks = (template.tasks || []).length
			? await projectTemplateTaskQueries.taskDocuments(
					{ _id: { $in: template.tasks }, tenantId, isDeleted: false },
					['_id', 'externalId']
			  )
			: []

		// The new order must contain every active task of the template exactly once
		const activeIds = activeTasks.map((task) => String(task._id))
		const sameSet =
			new Set(taskIds).size === taskIds.length &&
			taskIds.length === activeIds.length &&
			taskIds.every((id) => activeIds.includes(id))
		if (!sameSet) {
			throw badRequest(CONSTANTS.apiResponses.IDP_TEMPLATE_TASK_ORDER_MISMATCH)
		}

		const ordered = taskIds.map((id) => activeTasks.find((task) => String(task._id) === id))
		const orderedExternalIds = ordered.map((task) => task.externalId)
		// Deleted tasks (and any other sequence entries) keep their place after the active ones
		const otherTaskIds = (template.tasks || []).filter((id) => !activeIds.includes(String(id)))
		const otherSequence = (template.taskSequence || []).filter((id) => !orderedExternalIds.includes(id))

		await projectTemplateQueries.findOneAndUpdate(
			{ _id: template._id, tenantId },
			{
				$set: {
					tasks: [...ordered.map((task) => task._id), ...otherTaskIds],
					taskSequence: [...orderedExternalIds, ...otherSequence],
					updatedBy: userId,
				},
			}
		)

		await Promise.all(
			ordered.map((task, index) =>
				projectTemplateTaskQueries.findOneAndUpdate(
					{ _id: task._id, tenantId },
					{ $set: { sequenceNumber: String(index + 1), updatedBy: userId } }
				)
			)
		)

		return {
			success: true,
			message: CONSTANTS.apiResponses.IDP_TEMPLATE_TASKS_REORDERED,
			data: { taskSequence: orderedExternalIds },
		}
	}
}
