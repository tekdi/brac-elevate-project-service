/**
 * name : v1.js
 * author : Ankit Shahu
 * created-date : 9-Jan-2023
 * Description : Program Users validator.
 */

module.exports = (req) => {
	let programUsersValidator = {
		createOrUpdate: function () {
			// Either programId or programExternalId is required
			req.checkBody('programId')
				.custom((value) => {
					const hasId = req.body.programId || req.body.programExternalId
					if (!hasId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
				.optional()

			// Validate entity if provided
			req.checkBody('entity')
				.custom((value) => {
					if (value) {
						if (typeof value !== 'object' || Array.isArray(value)) {
							throw new Error('entity must be an object')
						}
						if (!value.userId) {
							throw new Error('entity.userId is required')
						}
						if (!value.entityId) {
							throw new Error('entity.entityId is required')
						}
					}
					return true
				})
				.optional()

			// Validate referenceFrom if provided
			req.checkBody('referenceFrom')
				.custom((value) => {
					if (value && (typeof value !== 'object' || Array.isArray(value))) {
						throw new Error('referenceFrom must be an object')
					}
					return true
				})
				.optional()

			// Validate hierarchy if provided
			req.checkBody('hierarchy')
				.custom((value) => {
					if (value) {
						if (!Array.isArray(value)) {
							throw new Error('hierarchy must be an array')
						}
						value.forEach((h, index) => {
							if (typeof h.level !== 'number' || h.level < 0) {
								throw new Error(`hierarchy[${index}].level must be a non-negative number`)
							}
							if (!h.id || typeof h.id !== 'string') {
								throw new Error(`hierarchy[${index}].id is required and must be a string`)
							}
						})
					}
					return true
				})
				.optional()

			// Validate status if provided
			req.checkBody('status')
				.custom((value) => {
					if (value) {
						const validStatuses = [
							'ACTIVE',
							'INACTIVE',
							'NOT_ONBOARDED',
							'ONBOARDED',
							'IN_PROGRESS',
							'COMPLETED',
							'GRADUATED',
							'DROPPED_OUT',
						]
						if (!validStatuses.includes(value)) {
							throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
						}
					}
					return true
				})
				.optional()

			// Validate metaInformation if provided
			req.checkBody('metaInformation')
				.custom((value) => {
					if (value && (typeof value !== 'object' || Array.isArray(value))) {
						throw new Error('metaInformation must be an object')
					}
					return true
				})
				.optional()
		},

		getEntities: function () {
			// Either programId or programExternalId is required
			req.checkQuery('programId')
				.custom((value) => {
					const hasId = req.query.programId || req.query.programExternalId
					if (!hasId) {
						throw new Error('Either programId or programExternalId is required')
					}
					return true
				})
				.optional()

			// Validate pagination parameters
			req.checkQuery('page')
				.custom((value) => {
					if (value) {
						const pageNum = parseInt(value)
						if (isNaN(pageNum) || pageNum < 1) {
							throw new Error('page must be a positive number')
						}
					}
					return true
				})
				.optional()

			req.checkQuery('limit')
				.custom((value) => {
					if (value) {
						const limitNum = parseInt(value)
						if (isNaN(limitNum) || limitNum < 1) {
							throw new Error('limit must be a positive number')
						}
					}
					return true
				})
				.optional()

			// Validate search if provided
			req.checkQuery('search').isString().withMessage('search must be a string').optional()
		},
	}

	if (programUsersValidator[req.params.method]) {
		programUsersValidator[req.params.method]()
	}
}
