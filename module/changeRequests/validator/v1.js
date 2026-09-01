/**
 * name : v1.js
 * Description : Change requests validator.
 */

module.exports = (req) => {
	let changeRequestsValidator = {
		list: function () {
			req.checkQuery('status')
				.custom((value) => {
					if (value && !['PENDING', 'APPROVED', 'REJECTED'].includes(value)) {
						throw new Error('status must be one of: PENDING, APPROVED, REJECTED')
					}
					return true
				})
				.optional()

			req.checkQuery('action')
				.custom((value) => {
					if (value && !['PROGRAM_USER_DROPPING_OUT', 'USER_PROJECT_TEMPLATE_CHANGE'].includes(value)) {
						throw new Error(
							'action must be one of: PROGRAM_USER_DROPPING_OUT, USER_PROJECT_TEMPLATE_CHANGE'
						)
					}
					return true
				})
				.optional()
		},

		decision: function () {
			req.checkBody('id').notEmpty().withMessage('id is required')

			req.checkBody('decision')
				.notEmpty()
				.withMessage('decision is required')
				.custom((value) => {
					if (!['APPROVED', 'REJECTED'].includes(value)) {
						throw new Error("decision must be either 'APPROVED' or 'REJECTED'")
					}
					return true
				})

			req.checkBody('reason').isString().withMessage('reason must be a string').optional()
		},

		requestChange: function () {
			if (!req?.userDetails?.userInformation?.userId) {
				throw new Error('User details are missing in the request')
			}
			req.checkBody('programId')
				.optional()
				.custom((value) => {
					if (!value && !req.body.programExternalId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
			req.checkBody('programExternalId')
				.optional()
				.custom((value) => {
					if (!value && !req.body.programId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
			req.checkBody('action')
				.notEmpty()
				.withMessage('action is required')
				.custom((value) => {
					if (!['PROGRAM_USER_DROPPING_OUT', 'USER_PROJECT_TEMPLATE_CHANGE'].includes(value)) {
						throw new Error(
							'action must be one of: PROGRAM_USER_DROPPING_OUT, USER_PROJECT_TEMPLATE_CHANGE'
						)
					}
					return true
				})
			req.checkBody('changePayload').notEmpty().withMessage('changePayload is required')
		},

		resolveSupervisor: function () {
			req.checkBody('userId').notEmpty().withMessage('userId is required')
			req.checkBody('tenantId').notEmpty().withMessage('tenantId is required')
			req.checkBody('programId')
				.optional()
				.custom((value, { req }) => {
					if (!value && !req.body.programExternalId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
			req.checkBody('programExternalId')
				.optional()
				.custom((value, { req }) => {
					if (!value && !req.body.programId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
		},
	}

	if (changeRequestsValidator[req.params.method]) {
		changeRequestsValidator[req.params.method]()
	}
}
