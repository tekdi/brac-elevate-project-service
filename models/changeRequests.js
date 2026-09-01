/**
 * name : changeRequests.js
 * Description : Schema for supervisor-approval change requests.
 * Shared by the dropout-approval and IDP/project-plan-change-approval flows.
 */

module.exports = {
	name: 'changeRequests',
	schema: {
		requestorId: {
			type: String,
			required: true,
			index: true,
		},
		requestorName: {
			type: String,
			required: true,
			index: true,
		},
		province: {
			type: String,
			required: true,
			index: true,
		},
		site: {
			type: String,
			required: true,
			index: true,
		},
		requestees: {
			type: [String],
			required: true,
			index: true,
		},
		programId: {
			type: String,
			index: true,
		},
		programExternalId: {
			type: String,
			index: true,
		},
		action: {
			type: String,
			enum: ['PROGRAM_USER_DROPPING_OUT', 'USER_PROJECT_TEMPLATE_CHANGE'],
			required: true,
			index: true,
		},
		entityId: {
			type: String,
			index: true,
		},
		entityName: {
			type: String,
			index: true,
		},
		changePayload: {
			type: Object,
			default: {},
		},
		changeSummary: {
			type: Object,
		},
		status: {
			type: String,
			enum: ['PENDING', 'APPROVED', 'REJECTED'],
			default: 'PENDING',
			index: true,
		},
		reason: {
			type: String,
		},
		tenantId: {
			type: String,
			required: true,
			index: true,
		},
		orgId: {
			type: String,
			index: true,
		},
		decidedAt: Date,
		decidedBy: String,
	},
	compoundIndex: [
		{
			name: { action: 1, entityId: 1, status: 1 },
			indexType: {},
		},
		{
			name: { status: 1, createdAt: -1 },
			indexType: {},
		},
	],
}
