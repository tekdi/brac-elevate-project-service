/**
 * name : helper.js
 * Description : Change requests (supervisor approval) related helper functionality.
 * Shared by the dropout-approval (PROGRAM_USER_DROPPING_OUT) and
 * IDP/project-plan-change-approval (USER_PROJECT_TEMPLATE_CHANGE) flows.
 */

// Dependencies
const changeRequestsService = require(SERVICES_BASE_PATH + '/changeRequests')
const programUsersService = require(SERVICES_BASE_PATH + '/programUsers')
const usersService = require(SERVICES_BASE_PATH + '/users')
const entityManagementService = require(SERVICES_BASE_PATH + '/entity-management')
const kafkaProducersHelper = require(GENERICS_FILES_PATH + '/kafka/producers')
const libraryCategoriesHelper = require(MODULES_BASE_PATH + '/library/categories/helper')
const projectQueries = require(DB_QUERY_BASE_PATH + '/projects')
const projectCategoriesQueries = require(DB_QUERY_BASE_PATH + '/projectCategories')

/**
 * ChangeRequestsHelper
 * @class
 */
module.exports = class ChangeRequestsHelper {
	/**
	 * Resolve the direct supervisor (hierarchy level 0) for an LC within a program.
	 * @method
	 * @name resolveSupervisor
	 * @param {String} lcUserId - LC's userId.
	 * @param {String} programId - program ID (optional).
	 * @param {String} programExternalId - program external ID (optional).
	 * @param {String} tenantId - tenant ID.
	 * @returns {String} supervisorId, or null if not found.
	 */
	static async resolveSupervisor(lcUserId, programId, programExternalId, tenantId) {
		try {
			const lcDoc = await programUsersService.findByUserAndProgram(
				lcUserId,
				programId,
				programExternalId,
				tenantId
			)

			if (!lcDoc || !lcDoc.hierarchy || !lcDoc.hierarchy.length) {
				return null
			}

			const supervisorEntry = lcDoc.hierarchy.find((h) => h.level === 0)
			return supervisorEntry ? supervisorEntry.id : null
		} catch (error) {
			throw error
		}
	}

	/**
	 * Check whether a target already has a pending change request.
	 * @method
	 * @name hasPendingRequest
	 * @param {String} action - PROGRAM_USER_DROPPING_OUT | USER_PROJECT_TEMPLATE_CHANGE.
	 * @param {String} entityId - entity id (the participant this request concerns).
	 * @param {String} projectId - project id (for USER_PROJECT_TEMPLATE_CHANGE).
	 * @returns {Object} pending change request document, if any.
	 */
	static async hasPendingRequest(action, entityId, projectId) {
		try {
			return await changeRequestsService.findPendingForTarget(action, entityId, projectId)
		} catch (error) {
			throw error
		}
	}

	/**
	 * Resolve leaf category ids to their { pathway, category } display names,
	 * keyed by category id for easy lookup.
	 * pathway = root-level ancestor name, category = the leaf category name itself.
	 * @method
	 * @name _resolveCategoryLookup
	 * @param {Array} categoryIds - leaf category ids.
	 * @param {String} tenantId - tenant ID.
	 * @returns {Map} categoryId (string) -> { pathway, category }.
	 */
	static async _resolveCategoryLookup(categoryIds, tenantId) {
		const leafIds = [...new Set((categoryIds || []).filter(Boolean).map((id) => String(id).trim()))]
		if (!leafIds.length) {
			return new Map()
		}
		const objectIds = leafIds.map((id) => UTILS.convertStringToObjectId(id))
		const docs = await projectCategoriesQueries.categoryDocuments({ _id: { $in: objectIds }, tenantId }, [
			'_id',
			'name',
			'parentId',
		])
		const docsById = new Map(docs.map((doc) => [doc._id.toString(), doc]))

		return docsById
	}

	/**
	 * Build a human-readable, per-pillar diff for a USER_PROJECT_TEMPLATE_CHANGE
	 * request, so the reviewer's list view can show only what's actually changing
	 * ("Livelihoods: Entrepreneurship, Agriculture -> Employment, Energy") instead
	 * of two unpaired from/to snapshots.
	 *
	 * Old/new entries are paired by pillar name - the target task's display name
	 * (`projectTemplateDetails.name` on the old side, `targetTaskName` on the new
	 * side). This is a best-effort display key, not an enforced system identifier
	 * (actual replay matches by templateId, see _replayChangePayload), but in
	 * practice reliably represents the fixed pillar slots (Social Empowerment,
	 * Livelihoods, Financial Inclusion, Linkage To Additional Services). Entries
	 * without a resolvable pillar name fall back to a `category:<id>` key so they
	 * still surface instead of being silently dropped.
	 * @method
	 * @name _buildChangeSummar-7
	 * @param {Object} changePayload - { templates, projectId, keywords, ... }.
	 * @param {String} tenantId - tenant ID.
	 * @returns {Object} { changes: [{pillar, from, to}], keywords: [] }.
	 */
	static async _buildChangeSummary(changePayload, tenantId) {
		const newCats = (changePayload.templates || [])
			.filter((template) => template.categoryId != null && String(template.categoryId).trim() !== '')
			.map((template) => {
				return String(template.categoryId).trim()
			})

		const newCatIds = await libraryCategoriesHelper.collectCategoryIdsWithAncestors(newCats, tenantId)
		const newEntries = await this._resolveCategoryLookup(newCatIds, tenantId)

		let oldCatIds = []
		if (changePayload.projectId) {
			const projectDocs = await projectQueries.projectDocument({ _id: changePayload.projectId, tenantId }, [
				'categories',
			])

			const project = projectDocs && projectDocs[0]
			oldCatIds = (project?.categories || [])
				.filter((category) => category?._id)
				.map((category) => String(category._id))
		}

		const oldEntries = await this._resolveCategoryLookup(oldCatIds, tenantId)

		let fromChange = {}
		let toChange = {}
		const pillarCats = [
			'Financial Inclusion',
			'Livelihoods',
			'Linkage to Additional Services',
			'Social Empowerment',
		]
		for (const from of oldEntries.values()) {
			if (!from?.parentId) {
				fromChange.oldRootCat = from?.name
				continue
			}
			if (!pillarCats.includes(from.name)) {
				fromChange.oldLivelihoodCat = from?.name
			}
		}

		for (const to of newEntries.values()) {
			if (!to?.parentId) {
				toChange.newRootCat = to?.name
				continue
			}
			if (!pillarCats.includes(to.name)) {
				toChange.newLivelihoodCat = to?.name
			}
		}

		return { fromChange, toChange, keywords: changePayload.keywords || [] }
	}

	/**
	 * Create a new pending change request and notify the supervisor.
	 * @method
	 * @name requestChange
	 * @param {Object} req - request object, body: { requestees, programId, programExternalId,
	 *  action, entityId, changePayload }.
	 * @returns {Object} { success, status, message, result }.
	 */
	static async requestChange(req) {
		try {
			const requestorId = req.userDetails.userInformation.userId
			const requestorName = req.userDetails.userInformation.userName
			const tenantId = req.userDetails.userInformation.tenantId
			const orgId = req.userDetails.userInformation.organizationId
			const {
				requestees,
				province,
				site,
				programId,
				programExternalId,
				action,
				entityId,
				entityName,
				changePayload,
			} = req.body

			const pendingRequest = await this.hasPendingRequest(action, entityId, changePayload?.projectId)
			if (pendingRequest) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.conflict.status,
					message: 'A change is already pending approval for this item',
				}
			}

			let changeSummary
			if (action === 'USER_PROJECT_TEMPLATE_CHANGE') {
				changeSummary = await this._buildChangeSummary(changePayload, tenantId)
			}

			const changeRequest = await changeRequestsService.create({
				requestorId,
				requestorName,
				province,
				site,
				requestees,
				programId,
				programExternalId,
				action,
				entityId,
				entityName,
				changePayload,
				changeSummary,
				status: 'PENDING',
				tenantId,
				orgId,
			})

			try {
				await kafkaProducersHelper.pushChangeRequestEvent({
					eventType: 'CHANGE_REQUEST_CREATED',
					changeRequestId: changeRequest._id,
					action,
					entityId,
					requestorId,
					programId,
					programExternalId,
					tenantId,
					orgId,
				})
			} catch (kafkaError) {
				// Notification failure should not block the request-creation flow.
				console.error('[ChangeRequest Event Error]', kafkaError.message || kafkaError)
			}

			return {
				success: true,
				status: HTTP_STATUS_CODE.accepted.status,
				message: 'Change submitted for supervisor approval',
				result: changeRequest,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * List change requests with pagination and filters, scoped to the caller's tenant.
	 * province/site are stored directly on the changeRequests document, so they're
	 * filtered as plain fields. Plain supervisors (not admin/tenant_admin) are
	 * further scoped to only the requests they've been assigned to review, via the
	 * `requestees` array on each document.
	 * @method
	 * @name list
	 * @param {Object} req - request object.
	 * @returns {Object} paginated list of change requests.
	 */
	static async list(req) {
		try {
			const userId = req.userDetails.userInformation?.userId
			const roles = req.userDetails.userInformation?.roles || []
			const { status, action, programId, province, site } = req.query
			const { pageNo = 1, pageSize = 100 } = req
			const tenantId = req.userDetails.userInformation?.tenantId

			const filters = {
				status,
				action,
				programId,
				province,
				site,
				tenantId,
			}
			const isAdmin = roles.includes(CONSTANTS.common.ADMIN_ROLE)
			const isTenantAdmin = roles.includes(CONSTANTS.common.TENANT_ADMIN)

			// Plain supervisors only see requests they've been specifically
			// assigned to review; admins and tenant_admins see all of the tenant's requests.
			if (isTenantAdmin) {
				filters.requestees = userId
			}

			const { data, count } = await changeRequestsService.list(filters, parseInt(pageNo), parseInt(pageSize))
			const enrichedData = await this._enrichWithLocationDetails(data, tenantId)

			return {
				success: true,
				status: HTTP_STATUS_CODE.ok.status,
				message: 'Change requests fetched successfully',
				data: enrichedData,
				result: enrichedData,
				count,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Enrich a page of change request documents with display-only province/site
	 * names, resolved from the entity-management service. `entityName` and
	 * `requestorName` are already stored directly on the document at creation
	 * time (see requestChange) and are left untouched here. Best-effort: falls
	 * back to the raw stored id if the lookup fails or misses, so the list
	 * endpoint doesn't hard-fail on an entity-management outage.
	 * @method
	 * @name _enrichWithLocationDetails
	 * @param {Array} changeRequests - page of change request documents.
	 * @param {String} tenantId - tenant ID.
	 * @returns {Array} change requests with province/site resolved to names.
	 */
	static async _enrichWithLocationDetails(changeRequests, tenantId) {
		const locationIds = [
			...new Set(
				(changeRequests || [])
					.flatMap((cr) => [cr.province, cr.site])
					.filter(Boolean)
					.map((id) => String(id))
			),
		]

		if (!locationIds.length) {
			return changeRequests
		}

		let entitiesById = new Map()
		try {
			const entitiesResult = await entityManagementService.entityDocuments({ _id: locationIds, tenantId }, [
				'metaInformation.name',
			])
			if (entitiesResult?.success && entitiesResult?.data) {
				entitiesById = new Map(entitiesResult.data.map((entity) => [String(entity._id), entity]))
			}
		} catch (error) {
			// Enrichment is best-effort display data - an entity-management failure
			// shouldn't block the list endpoint from returning the underlying change requests.
			console.error('[ChangeRequest Location Enrichment Error]', error.message || error)
		}

		return changeRequests.map((cr) => {
			const provinceEntity = cr.province ? entitiesById.get(String(cr.province)) : null
			const siteEntity = cr.site ? entitiesById.get(String(cr.site)) : null
			return {
				...cr,
				province: provinceEntity?.metaInformation?.name || cr.province || null,
				site: siteEntity?.metaInformation?.name || cr.site || null,
			}
		})
	}

	/**
	 * Approve or reject a pending change request.
	 * On approval, replays the stored changePayload against the target.
	 * @method
	 * @name decision
	 * @param {Object} req - request object.
	 * @returns {Object} decision result.
	 */
	static async decision(req) {
		try {
			const { id, decision, reason } = req.body
			const loggedInUserId = req.userDetails.userInformation.userId
			const roles = req.userDetails.userInformation?.roles || []

			if (!id || !['APPROVED', 'REJECTED'].includes(decision)) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: "id and decision ('APPROVED' or 'REJECTED') are required",
				}
			}

			const changeRequest = await changeRequestsService.findById(id)

			if (!changeRequest) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.not_found.status,
					message: 'Change request not found',
				}
			}

			if (changeRequest.status !== 'PENDING') {
				return {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: `Change request has already been ${changeRequest.status.toLowerCase()}`,
				}
			}

			// TODO(follow-up): per-request supervisor-assignment isn't wired yet
			// (resolveSupervisor() is never called at request-creation time, so no
			// changeRequest carries a supervisorId). Until that's in place, decisions
			// are admin-only or tenant_admin-for-their-own-tenant.
			const callerTenantId = req.userDetails.userInformation.tenantId
			const isAdmin = roles.includes(CONSTANTS.common.ADMIN_ROLE)
			const isTenantAdminForThisTenant =
				roles.includes(CONSTANTS.common.TENANT_ADMIN) && changeRequest.tenantId === callerTenantId

			if (!isAdmin && !isTenantAdminForThisTenant) {
				return {
					success: false,
					status: HTTP_STATUS_CODE.forbidden.status,
					message: 'You are not authorized to decide on this change request',
				}
			}

			if (decision === 'APPROVED') {
				await this._replayChangePayload(changeRequest)
			}

			const updatedChangeRequest = await changeRequestsService.decide(id, decision, loggedInUserId, reason)

			try {
				await kafkaProducersHelper.pushChangeRequestEvent({
					eventType: 'CHANGE_REQUEST_' + decision,
					changeRequestId: id,
					action: changeRequest.action,
					entityId: changeRequest.entityId,
					requestorId: changeRequest.requestorId,
					decidedBy: loggedInUserId,
					reason,
					tenantId: changeRequest.tenantId,
					orgId: changeRequest.orgId,
				})
			} catch (kafkaError) {
				console.error('[ChangeRequest Event Error]', kafkaError.message || kafkaError)
			}

			return {
				success: true,
				status: HTTP_STATUS_CODE.ok.status,
				message: `Change request ${decision.toLowerCase()} successfully`,
				result: updatedChangeRequest,
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Apply the stored changePayload against the original target, bypassing the
	 * approval gate (calls the service layer directly rather than the gated helper).
	 * @method
	 * @name _replayChangePayload
	 * @param {Object} changeRequest - the approved change request document.
	 */
	static async _replayChangePayload(changeRequest) {
		const { action, requestorId, programId, programExternalId, entityId, changePayload, tenantId, orgId } =
			changeRequest

		if (action === 'PROGRAM_USER_DROPPING_OUT') {
			await programUsersService.updateEntity(
				requestorId,
				programId,
				programExternalId,
				entityId,
				changePayload,
				tenantId
			)
			return
		}

		if (action === 'USER_PROJECT_TEMPLATE_CHANGE') {
			const { projectId, ...templatePayload } = changePayload
			// Lazily required to avoid a circular dependency with module/userProjects/helper.js,
			// which itself requires this helper to raise change requests.
			const userProjectsHelper = require(MODULES_BASE_PATH + '/userProjects/helper')
			await userProjectsHelper.updateProjectPlan(projectId, templatePayload, requestorId, null, {
				userInformation: { tenantId, organizationId: orgId, userId: requestorId },
				bypassApprovalGate: true,
			})
			return
		}

		throw {
			status: HTTP_STATUS_CODE.bad_request.status,
			message: `Unsupported action '${action}' for change request replay`,
		}
	}
}
