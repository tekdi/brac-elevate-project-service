/**
 * name : projects.js.
 * author : Aman Karki.
 * created-date : 14-July-2020.
 * Description : Schema for projects.
 */

module.exports = {
	name: 'projects',
	schema: {
		title: {
			type: String,
			index: true,
		},
		description: {
			type: String,
			index: true,
		},
		taskReport: {
			type: Object,
			default: {},
		},
		metaInformation: {
			type: Object,
			default: {},
		},
		userId: {
			type: String,
			default: 'SYSTEM',
			index: true,
		},
		userRole: {
			type: String,
			default: '',
			index: true,
		},
		status: {
			type: String,
			default: 'started',
			index: true,
		},
		lastDownloadedAt: Date,
		syncedAt: Date,
		isDeleted: {
			type: Boolean,
			default: false,
			index: true,
		},
		categories: {
			type: Array,
			default: [],
		},
		createdBy: {
			type: String,
			default: 'SYSTEM',
			index: true,
		},
		tasks: {
			type: Array,
			default: [],
		},
		entityInformation: {
			type: Object,
			default: {},
		},
		programInformation: {
			type: Object,
			default: {},
		},
		solutionInformation: {
			type: Object,
			default: {},
		},
		updatedBy: {
			type: String,
			default: 'SYSTEM',
		},
		// Legacy single template fields (kept for backward compatibility)
		projectTemplateId: {
			type: 'ObjectId',
			index: true,
		},
		projectTemplateExternalId: {
			type: String,
			index: true,
		},
		// New multiple templates support
		projectTemplates: {
			type: [
				{
					_id: {
						type: 'ObjectId',
						required: true,
					},
					externalId: {
						type: String,
						required: true,
					},
				},
			],
			default: [],
			description: 'Array of project templates associated with this project',
		},
		// keywords (OPTIONAL - FOR FILTERING/SEARCH)
		keywords: {
			type: [String],
			default: [],
			description: 'Optional tags for categorization and search',
		},
		startDate: Date,
		endDate: Date,
		learningResources: {
			type: Array,
			default: [],
		},
		entityId: {
			type: String,
			index: true,
		},
		programId: {
			type: 'ObjectId',
			index: true,
		},
		translations: Object,
		programExternalId: {
			type: String,
			index: true,
		},
		solutionId: {
			type: 'ObjectId',
			index: true,
		},
		solutionExternalId: {
			type: String,
			index: true,
		},
		isAPrivateProgram: {
			type: Boolean,
			index: true,
		},
		appInformation: Object,
		userRoleInformation: Object,
		hasAcceptedTAndC: {
			type: Boolean,
			default: false,
		},
		referenceFrom: {
			type: String,
			index: true,
		},
		project: Object,
		submissions: Object,
		link: {
			type: String,
			index: true,
		},
		taskSequence: {
			type: Array,
			default: [],
		},
		completedDate: Date,
		recommendedFor: {
			type: Array,
			default: [],
		},
		attachments: {
			type: Array,
			default: [],
		},
		remarks: String,
		userProfile: Object,
		certificate: {
			templateId: 'ObjectId',
			pdfPath: {
				type: String,
			},
			svgPath: {
				type: String,
			},
			transactionId: {
				type: String,
				index: true,
			},
			templateUrl: String,
			status: String,
			eligible: Boolean,
			message: String,
			issuedOn: Date,
			criteria: Object,
			reIssuedAt: Date,
			transactionIdCreatedAt: Date,
			originalTransactionInformation: {
				transactionId: String,
				pdfPath: String,
				svgPath: String,
			},
			callbackErrorEvent: {
				type: Boolean,
			},
		},
		acl: {
			visibility: {
				type: String,
				default: 'SELF',
			},
			users: {
				type: Array,
				default: [],
			},
			scope: {
				type: Object,
				default: {},
			},
		},
		updateHistory: {
			type: Array,
			default: [],
		},
		source: {
			type: Object,
			default: {},
		},
		reflection: {
			type: Object,
			default: {
				status: null,
				startDate: null,
				endDate: null,
			},
		},
		story: {
			type: Object,
			default: {},
		},
		duration: String,
		conversation: Array,
		tenantId: {
			type: String,
			index: true,
			required: true,
		},
		orgId: {
			type: String,
			index: true,
			required: true,
		},
		programUserMappingReference: {
			type: 'ObjectId',
		},
	},
	compoundIndex: [
		{
			name: { userId: 1, solutionId: 1, entityId: 1 },
			indexType: {
				unique: true,
				partialFilterExpression: { solutionId: { $exists: true }, entityId: { $exists: true } },
			},
		},
		// Index for querying by template ID in array (multiple templates)
		{
			name: { 'projectTemplates._id': 1 },
			indexType: {},
		},
	],
}
