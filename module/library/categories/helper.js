/**
 * name : helper.js
 * author : Aman
 * created-date : 16-July-2020
 * Description : Project categories helper functionality.
 */

// Dependencies
// const coreService = require(GENERICS_FILES_PATH + "/services/core");
// const sessionHelpers = require(GENERIC_HELPERS_PATH+"/sessions");
const projectCategoriesQueries = require(DB_QUERY_BASE_PATH + '/projectCategories')
const projectTemplateQueries = require(DB_QUERY_BASE_PATH + '/projectTemplates')
const projectTemplateTaskQueries = require(DB_QUERY_BASE_PATH + '/projectTemplateTask')
const moment = require('moment-timezone')
const filesHelpers = require(MODULES_BASE_PATH + '/cloud-services/files/helper')
const axios = require('axios')
const entitiesService = require(GENERICS_FILES_PATH + '/services/entity-management')
const projectAttributesQueries = require(DB_QUERY_BASE_PATH + '/projectAttributes')
const solutionAndProjectTemplateUtils = require(GENERICS_FILES_PATH + '/helpers/solutionAndProjectTemplateUtils')
const orgExtensionQueries = require(DB_QUERY_BASE_PATH + '/organizationExtension')

/**
 * LibraryCategoriesHelper
 * @class
 */

module.exports = class LibraryCategoriesHelper {
	/**
	 * Validate parentId for category operations
	 * @method
	 * @name validateParentId
	 * @param {String} parentId - parent category id
	 * @param {String} categoryId - current category id (for update operations)
	 * @param {String} tenantId - tenant id
	 * @returns {Object} validation result
	 */
	static async validateParentId(parentId, categoryId = null, tenantId) {
		if (!parentId) {
			return { success: true, parentCategory: null }
		}

		// Convert to ObjectId safely
		const parentObjectId = UTILS.convertStringToObjectId(parentId)
		if (!parentObjectId) {
			throw {
				success: false,
				status: HTTP_STATUS_CODE.bad_request.status,
				message: 'Invalid parentId format',
			}
		}

		// Check if parent category exists, is not deleted, and is in the same tenant
		const parentCategory = await projectCategoriesQueries.categoryDocuments(
			{
				_id: parentObjectId,
				tenantId: tenantId,
				isDeleted: false,
			},
			['_id', 'hasChildCategories', 'parentId']
		)

		if (!parentCategory || parentCategory.length === 0) {
			throw {
				success: false,
				status: HTTP_STATUS_CODE.bad_request.status,
				message: 'Parent category not found or does not belong to the same tenant',
			}
		}

		const parent = parentCategory[0]

		if (categoryId) {
			// Cannot set category as its own parent
			if (parentId.toString() === categoryId.toString()) {
				throw {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'Category cannot be its own parent',
				}
			}

			// Cannot move category to its own descendant (circular reference)
			const isDescendant = await this.isDescendant(parentId, categoryId, tenantId)
			if (isDescendant) {
				throw {
					success: false,
					status: HTTP_STATUS_CODE.bad_request.status,
					message: 'Cannot move category to its own descendant - would create circular reference',
				}
			}
		}

		return { success: true, parentCategory: parent }
	}

	/**
	 * Check if a category is a descendant of another category
	 * @method
	 * @name isDescendant
	 * @param {String} potentialDescendantId - category to check if it's a descendant
	 * @param {String} ancestorId - potential ancestor category
	 * @param {String} tenantId - tenant id
	 * @returns {Boolean} true if potentialDescendantId is a descendant of ancestorId
	 */
	static async isDescendant(potentialDescendantId, ancestorId, tenantId) {
		let currentId = potentialDescendantId

		while (currentId) {
			if (currentId.toString() === ancestorId.toString()) {
				return true
			}

			const category = await projectCategoriesQueries.categoryDocuments(
				{
					_id: UTILS.convertStringToObjectId(currentId),
					tenantId: tenantId,
					isDeleted: false,
				},
				['parentId']
			)

			if (!category || category.length === 0 || !category[0].parentId) {
				break
			}

			currentId = category[0].parentId
		}

		return false
	}

	/**
	 * Get the hierarchy depth for a given category
	 * @method
	 * @name getHierarchyDepth
	 * @param {String} categoryId - category id
	 * @param {String} tenantId - tenant id
	 * @returns {Number} hierarchy depth
	 */
	static async getHierarchyDepth(categoryId, tenantId) {
		let depth = 0
		let currentId = categoryId

		while (currentId && depth < 10) {
			// Safety limit to prevent infinite loops
			const category = await projectCategoriesQueries.categoryDocuments(
				{
					_id: UTILS.convertStringToObjectId(currentId),
					tenantId: tenantId,
					isDeleted: false,
				},
				['parentId']
			)

			if (!category || category.length === 0 || !category[0].parentId) {
				break
			}

			currentId = category[0].parentId
			depth++
		}

		return depth
	}

	/**
	 * For each category id, collect that id and every ancestor by following parentId until parentId is null (root).
	 * Use when the client selects a leaf/deep category but the project should include the full chain.
	 * @param {Array<String>} categoryIds - One or more category ids (typically leaf ids from the request)
	 * @param {String} tenantId - Tenant id
	 * @returns {Promise<Array<String>>} Unique category ids as strings
	 */
	static async collectCategoryIdsWithAncestors(categoryIds, tenantId) {
		const seedIds = [...new Set((categoryIds || []).map((id) => (id ? String(id).trim() : '')).filter(Boolean))]
		const result = new Set()

		for (const startId of seedIds) {
			let currentId = startId
			const visited = new Set()
			// Walk from leaf to root until parentId is null. If we see the same id again, stop (cyclic parent chain in DB).
			while (currentId != null && String(currentId).trim() !== '') {
				const idKey = String(currentId).trim()
				if (visited.has(idKey)) {
					break
				}
				visited.add(idKey)
				result.add(idKey)
				const docs = await projectCategoriesQueries.categoryDocuments(
					{
						_id: UTILS.convertStringToObjectId(idKey),
						tenantId: tenantId,
						isDeleted: false,
					},
					['parentId']
				)
				const parentId = docs && docs[0] ? docs[0].parentId : null
				if (parentId == null) {
					break
				}
				currentId = parentId.toString()
			}
		}
		return Array.from(result)
	}

	/**
	 * List of library projects.
	 * @method
	 * @name projects
	 * @param categoryId - category external id.
	 * @param pageSize - Size of page.
	 * @param pageNo - Recent page no.
	 * @param search - search text.
	 * @param sortedData - Data to be sorted.
	 * @param userDetails - user related info
	 * @param tenantId - tenant id info
	 * @param orgId - org id info
	 * @param language - pass language code for the translation
	 * @param hasSpotlight - true/false for filtering based on hasSpotlight key
	 * @param filter - Data to be filtered
	 * @returns {Object} List of library projects.
	 */

	static projects(
		categoryId,
		pageSize,
		pageNo,
		search,
		sortedData,
		userDetails,
		language = 'en',
		hasSpotlight = false,
		filter = {}
	) {
		return new Promise(async (resolve, reject) => {
			try {
				const defaultLanguage = 'en'
				const userLanguage = language

				let matchQuery = {
					$match: {
						status: CONSTANTS.common.PUBLISHED,
						isReusable: true,
					},
				}

				// Fetch the organization extension document of the loggedin user
				let orgExtension = await orgExtensionQueries.orgExtenDocuments({
					tenantId: userDetails.userInformation.tenantId,
					orgId: userDetails.userInformation.organizationId,
				})

				if (!orgExtension || orgExtension.length === 0) {
					orgExtension = null
				} else {
					orgExtension = orgExtension[0]
				}

				matchQuery['$match']['tenantId'] = userDetails.userInformation.tenantId
				/**
				 *
					Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = CURRENT
					{
						"$match": {
							"status": "published",
							"isReusable": true,
							"tenantId": "shikshalokam",
							"orgId": "slorg"
						}
					}
				*/
				/**
				 *
					Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = ASSOCIATED
					{
						"$match": {
							"status": "published",
							"isReusable": true,
							"tenantId": "shikshalokam",
							"$and": [
								{
								"$or": [
									{
										"visibility": {
											"$ne": "CURRENT"
										},
										"visibleToOrganizations": {
											"$in": [
												"sot"
											]
										}
									},
									{
										"orgId": "sot"
									}
								]
								}
							]
						}
					}
				*/
				/**
				 *
					Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = ALL
					{
						"$match": {
						"status": "published",
						"isReusable": true,
						"tenantId": "shikshalokam",
						"$and": [
							{
							"$or": [
								{
									"visibility": "ALL"
								},
								{
									"visibility": {
										"$ne": "CURRENT"
									},
									"visibleToOrganizations": {
										"$in": [
											"mys"
										]
									}
								},
								{
									"orgId": "mys"
								}
							]
							}
						]
						}
					}
				*/
				matchQuery = applyVisibilityConditions(matchQuery, orgExtension, userDetails)

				if (categoryId && categoryId !== '') {
					matchQuery['$match']['categories.externalId'] = categoryId
				}

				let aggregateData = []
				aggregateData.push(matchQuery)

				if (hasSpotlight) {
					matchQuery['$match']['hasSpotlight'] = true
				}

				if (Object.keys(filter).length >= 1) {
					let duration = filter.duration || ''
					let roles = filter.roles || ''

					// Split duration only if it has a value
					if (duration) {
						const durationArray = duration.split(',')
						let defaultDurationAttributes

						// Fetch the project attributes document for the duration
						const projectAttributesDocument = await projectAttributesQueries.projectAttributesDocument({
							code: 'duration',
							deleted: false,
						})

						if (projectAttributesDocument && projectAttributesDocument.length > 0) {
							defaultDurationAttributes = projectAttributesDocument[0]
						} else {
							defaultDurationAttributes = CONSTANTS.common.DEFAULT_ATTRIBUTES.find(
								(attr) => attr.code === 'duration'
							)
						}

						const entities = defaultDurationAttributes?.entities || []

						const matchingDurations = entities
							.map((entity) => entity.value)
							.filter((value) => durationArray.includes(value))

						let upperBoundDurationFilter = []
						let exactDurationFilters = []
						// Separate values that start with "More than" into `upperBoundDurationFilter`, others into `exactDurationFilters`
						matchingDurations.forEach((value) => {
							if (value.startsWith('More than')) {
								upperBoundDurationFilter.push(value.replace('More than ', '').trim())
							} else {
								exactDurationFilters.push(value)
							}
						})

						let minDays = Infinity
						let exactDurationFiltersInDays = []
						if (upperBoundDurationFilter.length > 0) {
							// Initialize with a large number

							// Convert to days and find the lowest duration
							if (upperBoundDurationFilter.length > 0) {
								upperBoundDurationFilter.forEach((item) => {
									const days = UTILS.convertDurationToDays(item) // Convert duration to days
									minDays = Math.min(minDays, days) // Keep track of the minimum days
								})
							}
						}

						// Convert exact duration filters to days
						if (exactDurationFilters.length > 0) {
							exactDurationFiltersInDays = exactDurationFilters.map((item) =>
								UTILS.convertDurationToDays(item)
							)
						}

						// construct the match query for filters
						if (minDays !== Infinity && exactDurationFiltersInDays.length > 0) {
							matchQuery['$match']['$and'] = [
								...(matchQuery['$match']['$and'] || []),
								{ durationInDays: { $gt: minDays } }, // Use $gt for greater than
								{ durationInDays: { $in: exactDurationFiltersInDays } }, // For exact durations
							]
						} else if (minDays !== Infinity) {
							matchQuery['$match']['durationInDays'] = { $gt: minDays } // Use $gt for greater than
						} else if (exactDurationFiltersInDays.length > 0) {
							matchQuery['$match']['durationInDays'] = { $in: exactDurationFiltersInDays } // Handle $in independently
						}
					}

					// Split roles only if it has a value
					if (roles) {
						roles = roles.split(',')
						if (roles.length > 0) {
							//Getting roles from the entity service
							let userRoleInformation = await entitiesService.getUserRoleExtensionDocuments(
								{
									code: { $in: roles },
									tenantId: userDetails.userInformation.tenantId,
									orgId: { $in: [userDetails.userInformation.organizationId] },
								},
								['title']
							)
							if (!userRoleInformation.success) {
								throw {
									message: CONSTANTS.apiResponses.FAILED_TO_FETCH_USERROLE,
									status: HTTP_STATUS_CODE.bad_request.status,
								}
							}
							// Extract titles
							let userRoles = await userRoleInformation.data.map((eachRole) => eachRole.title)
							matchQuery['$match']['recommendedFor'] = { $in: userRoles }
						}
					}
				}

				const searchConditions = []
				if (search !== '') {
					if (userLanguage === defaultLanguage) {
						searchConditions.push(
							{ title: new RegExp(search, 'i') },
							{ description: new RegExp(search, 'i') },
							{ categories: new RegExp(search, 'i') }
						)
					} else {
						searchConditions.push(
							{ [`translations.${userLanguage}.title`]: new RegExp(search, 'i') },
							{ [`translations.${userLanguage}.description`]: new RegExp(search, 'i') },
							{ title: new RegExp(search, 'i') },
							{ description: new RegExp(search, 'i') },
							{ categories: new RegExp(search, 'i') }
						)
					}

					// Add into $and instead of overwriting
					matchQuery.$match.$and = [...(matchQuery.$match.$and || []), { $or: searchConditions }]
				}

				let sortedQuery = {
					$sort: {
						createdAt: -1,
					},
				}
				if (sortedData && sortedData === CONSTANTS.common.IMPORTANT_PROJECT) {
					sortedQuery['$sort'] = {}
					sortedQuery['$sort']['noOfRatings'] = -1
				}

				aggregateData.push(sortedQuery)

				aggregateData.push(
					{
						$project: {
							title: {
								$ifNull: [`$translations.${language}.title`, '$title'],
							},
							description: {
								$ifNull: [`$translations.${language}.description`, '$description'],
							},
							impact: {
								$ifNull: [`$translations.${language}.impact`, '$impact'],
							},
							summary: {
								$ifNull: [`$translations.${language}.summary`, '$summary'],
							},
							story: {
								$ifNull: [`$translations.${language}.story`, '$story'],
							},
							author: {
								$ifNull: [`$translations.${language}.author`, '$author'],
							},
							externalId: 1,
							noOfRatings: 1,
							averageRating: 1,
							createdAt: 1,
							categories: 1,
							metaInformation: 1,
							recommendedFor: 1,
							evidences: 1,
							translations: 1,
						},
					},
					{
						$facet: {
							totalCount: [{ $count: 'count' }],
							data: [{ $skip: pageSize * (pageNo - 1) }, { $limit: pageSize }],
						},
					},
					{
						$project: {
							data: 1,
							count: {
								$arrayElemAt: ['$totalCount.count', 0],
							},
						},
					}
				)
				let result = await projectTemplateQueries.getAggregate(aggregateData)

				if (result[0].data.length > 0) {
					for (const resultedData of result[0].data) {
						// add as new if its created within 7 days
						let timeDifference = moment().diff(moment(resultedData.createdAt), 'days')
						resultedData.new = false
						if (timeDifference <= 7) {
							resultedData.new = true
						}
						// Process evidences
						if (resultedData.evidences && resultedData.evidences.length > 0) {
							for (const eachEvidence of resultedData.evidences) {
								try {
									const downloadableUrl = await filesHelpers.getDownloadableUrl([eachEvidence.link])
									eachEvidence.downloadableUrl = downloadableUrl.result[0].url
								} catch (error) {
									console.error('Error fetching downloadable URL:', error)
								}
							}
						}
					}
				}

				let projectTemplates = result[0].data
				let allCategoryId = []
				let filePathsArray = []

				for (let project of projectTemplates) {
					let categories = project.categories
					if (categories.length > 0) {
						let categoryIdArray = categories.map((category) => {
							if (category._id) {
								return category._id
							}
						})
						allCategoryId.push(...categoryIdArray)
					}
				}

				let allCategoryInfo = await projectCategoriesQueries.categoryDocuments({
					_id: { $in: allCategoryId },
					tenantId: userDetails.userInformation.tenantId,
				})
				for (let singleCategoryInfo of allCategoryInfo) {
					if (singleCategoryInfo.evidences && singleCategoryInfo.evidences.length > 0) {
						let filePaths = singleCategoryInfo.evidences.map((evidenceInfo) => {
							return evidenceInfo.filepath
						})
						filePathsArray.push({
							categoryId: singleCategoryInfo._id,
							filePaths,
						})
					}
				}

				for (let project of projectTemplates) {
					let categories = project.categories

					if (categories.length > 0) {
						for (let projectCategory of categories) {
							let filteredCategory = allCategoryInfo.filter((category) => {
								return category._id.toString() == projectCategory._id.toString()
							})
							if (filteredCategory.length > 0) {
								let singleCategoryInfo = filteredCategory[0]
								projectCategory.evidences = singleCategoryInfo.evidences
							}
						}
					}
				}

				let allFilePaths = filePathsArray.map((project) => {
					return project.filePaths
				})
				// `allFilePaths` is an array of arrays containing file paths.
				// Use Lodash's `_.flatten` to convert this into a single, flat array of file paths.
				// Example: [[path1, path2], [path3]] => [path1, path2, path3]
				let flattenedFilePathArr = _.flatten(allFilePaths)

				if (flattenedFilePathArr.length > 0) {
					let downloadableUrlsCall = await filesHelpers.getDownloadableUrl(flattenedFilePathArr)
					if (downloadableUrlsCall.message !== CONSTANTS.apiResponses.CLOUD_SERVICE_SUCCESS_MESSAGE) {
						throw {
							message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
							data: {
								data: [],
								count: 0,
							},
						}
					}

					let downloadableUrls = downloadableUrlsCall.result

					let urlDictionary = {}
					for (let singleURL of downloadableUrls) {
						let url = singleURL.url
						let filePath = singleURL.filePath
						urlDictionary[filePath] = url
					}

					for (const template of projectTemplates) {
						const { categories } = template

						if (categories.length > 0) {
							for (const category of categories) {
								const { evidences } = category
								if (!evidences || evidences.length === 0) {
									continue
								}

								for (const [index, singleEvidence] of evidences.entries()) {
									const downloadablePath = urlDictionary[singleEvidence.filepath]
									category.evidences[index].downloadableUrl = downloadablePath
								}
							}
						}
					}

					result[0].data = projectTemplates
				}
				result[0].data.map(async (projectTemplate) => {
					if (projectTemplate.metaInformation) {
						const metaInformation = projectTemplate.metaInformation
						// get the translated data if language is other than 'en'
						if (language != 'en') {
							await UTILS.getTranslatedData(metaInformation, projectTemplate.translations[language])
						}
						// add metaInformation keys to the root of the project
						Object.keys(metaInformation).map((key) => {
							projectTemplate[key] = metaInformation[key]
						})
						delete projectTemplate.metaInformation
					}
					delete projectTemplate.translations
				})
				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					data: {
						data: result[0].data,
						count: result[0].count ? result[0].count : 0,
					},
				})
			} catch (error) {
				return reject({
					success: false,
					status: HTTP_STATUS_CODE.not_found.status,
					message: error.message,
				})
			}
		})
	}

	/**
	 * Update categories
	 * @method
	 * @name update
	 * @param filterQuery - Filter query.
	 * @param updateData - Update data.
	 * @param files - files
	 * @param userDetails - user related information
	 * @returns {Object} updated data
	 */

	static update(filterQuery, updateData, files, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let matchQuery = { _id: filterQuery._id }
				matchQuery['tenantId'] = userDetails.tenantAndOrgInfo.tenantId

				let categoryData = await projectCategoriesQueries.categoryDocuments(matchQuery, 'all')

				// Throw error if category is not found
				if (
					!categoryData ||
					!(categoryData.length > 0) ||
					!(Object.keys(categoryData[0]).length > 0) ||
					categoryData[0]._id == ''
				) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CATEGORY_NOT_FOUND,
					}
				}

				// Validate parent_id if provided in updateData
				if (updateData.parentId !== undefined) {
					let parentCategory
					const validationResult = await this.validateParentId(
						updateData.parentId,
						categoryData[0]._id.toString(),
						userDetails.tenantAndOrgInfo.tenantId
					)
					parentCategory = validationResult.parentCategory
				}

				// Handle evidence uploads
				let evidenceUploadData = await handleEvidenceUpload(files, userDetails.userInformation.userId)
				evidenceUploadData = evidenceUploadData.data

				// Update the sequence numbers
				updateData['evidences'] = []

				if (categoryData[0].evidences && categoryData[0].evidences.length > 0) {
					for (const evidence of evidenceUploadData) {
						evidence.sequence += categoryData[0].evidences.length
						categoryData[0].evidences.push(evidence)
					}
					updateData['evidences'] = categoryData[0].evidences
				} else {
					updateData['evidences'] = evidenceUploadData
				}

				// delete tenantId & orgId attached in req.body to avoid adding manupulative data
				delete updateData.tenantId
				delete updateData.orgId

				filterQuery['tenantId'] = userDetails.tenantAndOrgInfo.tenantId

				// Update the category
				let categoriesUpdated = await projectCategoriesQueries.updateMany(filterQuery, updateData)

				if (!categoriesUpdated) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_NOT_UPDATED,
					}
				}

				// Update hasChildCategories for old and new parents
				if (updateData.parentId !== undefined) {
					const tenantId = userDetails.tenantAndOrgInfo.tenantId
					const categoryId = categoryData[0]._id.toString()

					// Handle old parent: check if it has any other children
					if (categoryData[0].parentId && categoryData[0].parentId.toString() !== updateData.parentId) {
						const otherChildren = await projectCategoriesQueries.categoryDocuments(
							{
								parentId: categoryData[0].parentId,
								tenantId: tenantId,
								isDeleted: false,
								status: CONSTANTS.common.ACTIVE,
							},
							['_id']
						)

						await projectCategoriesQueries.updateMany(
							{ _id: categoryData[0].parentId },
							{ hasChildCategories: otherChildren && otherChildren.length > 0 }
						)
					}

					// Handle new parent: set hasChildCategories to true
					if (updateData.parentId) {
						await projectCategoriesQueries.updateMany(
							{ _id: updateData.parentId },
							{ hasChildCategories: true }
						)
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_UPDATED,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Details of library projects.
	 * @method
	 * @name projectDetails
	 * @param projectId - project internal id.
	 * @param language - languageCode
	 * @returns {Object} Details of library projects.
	 */

	static projectDetails(projectId, userToken = '', isATargetedSolution = '', language = '', userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let tenantId = userDetails.userInformation.tenantId
				let orgId = userDetails.userInformation.organizationId
				let projectsData = await projectTemplateQueries.templateDocument(
					{
						_id: projectId,
						status: CONSTANTS.common.PUBLISHED,
						isDeleted: false,
						tenantId: tenantId,
					},
					'all',
					['__v']
				)

				if (!projectsData.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_NOT_FOUND,
					}
				}

				projectsData[0].showProgramAndEntity = false

				if (projectsData[0].tasks && projectsData[0].tasks.length > 0) {
					let tasks = await projectTemplateTaskQueries.taskDocuments({
						_id: {
							$in: projectsData[0].tasks,
						},
						isDeleted: false,
					})

					if (tasks && tasks.length > 0) {
						let taskData = {}

						for (let taskPointer = 0; taskPointer < tasks.length; taskPointer++) {
							let currentTask = tasks[taskPointer]

							if (
								currentTask.type === CONSTANTS.common.ASSESSMENT ||
								currentTask.type === CONSTANTS.common.OBSERVATION
							) {
								projectsData[0].showProgramAndEntity = true
							}

							if (currentTask.parentId && currentTask.parentId !== '') {
								if (!taskData[currentTask.parentId.toString()]) {
									taskData[currentTask.parentId.toString()].children = []
								}

								taskData[currentTask.parentId.toString()].children.push(
									_.omit(currentTask, ['parentId'])
								)
							} else {
								currentTask.children = []
								taskData[currentTask._id.toString()] = currentTask
							}
						}

						projectsData[0].tasks = Object.values(taskData)
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECTS_FETCHED,
					data: projectsData[0],
				})
			} catch (error) {
				return resolve({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * create categories
	 * @method
	 * @name create
	 * @param categoryData - categoryData.
	 * @param files - files.
	 * @param userDetails - user decoded token details.
	 * @returns {Object} category details
	 */

	static create(categoryData, files, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const tenantId = userDetails.tenantAndOrgInfo.tenantId
				const orgId = userDetails.tenantAndOrgInfo.orgId

				// Check if organization extension exists for the loggedin user
				let orgExtension
				orgExtension = await orgExtensionQueries.orgExtenDocuments({
					tenantId,
					orgId: orgId[0],
				})

				//Throw error if org policy is not found
				if (!orgExtension || orgExtension.length === 0) {
					throw {
						success: false,
						status: HTTP_STATUS_CODE.not_found.status,
						message: CONSTANTS.apiResponses.ORG_EXTENSION_NOT_FOUND,
					}
				}

				// Check if the category already exists
				let filterQuery = {}
				filterQuery['externalId'] = categoryData.externalId.toString()
				filterQuery['tenantId'] = tenantId

				const checkIfCategoryExist = await projectCategoriesQueries.categoryDocuments(filterQuery, [
					'_id',
					'externalId',
				])

				// Throw error if the category already exists
				if (
					checkIfCategoryExist.length > 0 &&
					Object.keys(checkIfCategoryExist[0]).length > 0 &&
					checkIfCategoryExist[0]._id != ''
				) {
					throw {
						success: false,
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.CATEGORY_ALREADY_EXISTS,
					}
				}

				// Validate parent_id if provided
				let parentCategory = null
				if (categoryData.parentId) {
					const validationResult = await this.validateParentId(categoryData.parentId, null, tenantId)
					parentCategory = validationResult.parentCategory
				}

				// Auto-assign sequenceNumber based on siblings under same parent
				let sequenceNumber = 0
				if (categoryData.parentId) {
					// Find max sequenceNumber among siblings
					const siblings = await projectCategoriesQueries.categoryDocuments(
						{
							parentId: categoryData.parentId,
							tenantId: tenantId,
							isDeleted: false,
						},
						['sequenceNumber']
					)

					if (siblings && siblings.length > 0) {
						const maxSequence = Math.max(...siblings.map((sibling) => sibling.sequenceNumber || 0))
						sequenceNumber = maxSequence + 1
					}
				} else {
					// For root level categories, find max sequenceNumber among root categories
					const rootCategories = await projectCategoriesQueries.categoryDocuments(
						{
							parentId: null,
							tenantId: tenantId,
							isDeleted: false,
						},
						['sequenceNumber']
					)

					if (rootCategories && rootCategories.length > 0) {
						const maxSequence = Math.max(...rootCategories.map((category) => category.sequenceNumber || 0))
						sequenceNumber = maxSequence + 1
					}
				}
				categoryData.sequenceNumber = sequenceNumber

				// Fetch the signed urls from handleEvidenceUpload function
				const evidences = await handleEvidenceUpload(files, userDetails.userInformation.userId)
				categoryData['evidences'] = evidences.data

				// add tenantId and orgId
				categoryData['tenantId'] = tenantId
				categoryData['orgId'] = orgId[0]
				categoryData['visibleToOrganizations'] = orgId

				let projectCategoriesData = await projectCategoriesQueries.create(categoryData)

				if (!projectCategoriesData._id) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_NOT_ADDED,
					}
				}

				// Update parent's hasChildCategories to true if parent exists
				if (parentCategory && !parentCategory.hasChildCategories) {
					await projectCategoriesQueries.updateMany(
						{ _id: parentCategory._id, tenantId: tenantId },
						{ hasChildCategories: true }
					)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_ADDED,
					data: projectCategoriesData._id,
				})
			} catch (error) {
				return reject({
					status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * list categories
	 * @method
	 * @name list
	 * @param {Object} req - user decoded token details
	 * @returns {Object} category details
	 */

	static list(searchText, params, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let tenantId = userDetails.userInformation.tenantId
				let organizationId = userDetails.userInformation.organizationId
				let query = {
					visibleToOrganizations: { $in: [organizationId] },
				}

				// create query to fetch assets
				query['tenantId'] = tenantId
				query['status'] = CONSTANTS.common.ACTIVE_STATUS
				query['isDeleted'] = false

				// handle currentOrgOnly filter
				if (params['currentOrgOnly']) {
					let currentOrgOnly = UTILS.convertStringToBoolean(params['currentOrgOnly'])
					if (currentOrgOnly) {
						query['orgId'] = { $in: ['ALL', organizationId] }
					}
				}
				// Handle parentId query param. Accepts: actual id, omitted, or the string 'null' (for root)
				let parentCategory = null
				if (params.parentId) {
					const rawParent = params.parentId
					// if client sends ?parentId=null or empty string, treat as root (parentId === null)
					if (rawParent === 'null' || rawParent === null || rawParent === '') {
						query['parentId'] = null
					} else {
						// Convert to ObjectId safely to avoid mongoose casting errors
						const parentObjectId = UTILS.convertStringToObjectId(rawParent)
						if (!parentObjectId) {
							throw {
								success: false,
								status: HTTP_STATUS_CODE.bad_request.status,
								message: 'Invalid parentId provided',
							}
						}
						// Check if parent category exists, is not deleted, and is in the same tenant
						parentCategory = await projectCategoriesQueries.categoryDocuments(
							{ _id: parentObjectId, tenantId: tenantId, isDeleted: false },
							['_id', 'hasChildCategories']
						)

						if (!parentCategory || parentCategory.length === 0) {
							throw {
								success: false,
								status: HTTP_STATUS_CODE.bad_request.status,
								message: 'Parent category not found or does not belong to the same tenant',
							}
						}
						query['parentId'] = parentObjectId
					}
				}

				// Add keywords filter - categories must have at least one of the specified keywords
				if (params.keywords && params.keywords.trim() !== '') {
					const keywordsArray = params.keywords
						.split(',')
						.map((k) => k.trim())
						.filter((k) => k !== '')
					if (keywordsArray.length > 0) {
						query['keywords'] = { $in: keywordsArray }
					}
				}

				// Add search functionality for name and description (separate from keywords filter)
				if (searchText && searchText.trim() !== '') {
					const searchTerm = searchText.trim()
					query['$or'] = [
						{ name: new RegExp(searchTerm, 'i') },
						{ description: new RegExp(searchTerm, 'i') },
						{ externalId: new RegExp(searchTerm, 'i') },
					]
				}

				const skipFields = ['__v', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy']
				let categoryData = await projectCategoriesQueries.categoryDocuments(query, 'all', skipFields)

				if (!categoryData.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.ok.status,
						message: CONSTANTS.apiResponses.LIBRARY_CATEGORIES_NOT_FOUND,
					}
				}

				// If getChildren is true, fetch immediate children for each category
				if (params.getChildren) {
					let getChildren = UTILS.convertStringToBoolean(params['getChildren'])
					if (getChildren) {
						for (let category of categoryData) {
							let childrenQuery = {
								parentId: category._id,
								tenantId: tenantId,
								status: CONSTANTS.common.ACTIVE_STATUS,
								isDeleted: false,
							}

							let children = await projectCategoriesQueries.categoryDocuments(
								childrenQuery,
								'all',
								skipFields
							)

							category.children = children
							category.childrenCount = children.length
						}
					}
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_FETCHED,
					data: categoryData,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Delete library category.
	 * @method
	 * @name delete
	 * @param {Object} filterQuery - filter query
	 * @param {Object} userDetails - user details
	 * @returns {Object} Delete operation result
	 */
	static delete(filterQuery, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				const tenantId = userDetails.userInformation.tenantId
				const categoryId = filterQuery._id

				// Find the category to delete
				let categoryData = await projectCategoriesQueries.categoryDocuments(
					{
						_id: categoryId,
						tenantId: tenantId,
						isDeleted: false,
					},
					'all'
				)

				if (!categoryData || categoryData.length === 0) {
					throw {
						status: HTTP_STATUS_CODE.not_found.status,
						message: CONSTANTS.apiResponses.CATEGORY_NOT_FOUND,
					}
				}

				categoryData = categoryData[0]

				// Check if category has children
				const children = await projectCategoriesQueries.categoryDocuments(
					{
						parentId: categoryId,
						tenantId: tenantId,
						isDeleted: false,
					},
					['_id']
				)

				if (children && children.length > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message:
							'Cannot delete category that has child categories. Please delete or move child categories first.',
					}
				}

				// Check if category has associated projects
				const associatedTemplates = categoryData.noOfProjects || 0

				if (associatedTemplates > 0) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message:
							'Cannot delete category that has associated project templates. Please remove the category from templates first.',
					}
				}

				// Soft delete the category
				const updateResult = await projectCategoriesQueries.updateMany(
					{ _id: categoryId, tenantId: tenantId },
					{
						isDeleted: true,
						updatedBy: userDetails.userInformation.userId,
						updatedAt: new Date(),
					}
				)

				if (!updateResult) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_NOT_DELETED,
					}
				}

				// Update parent's hasChildCategories if this was the last child
				if (categoryData.parentId) {
					const siblings = await projectCategoriesQueries.categoryDocuments(
						{
							parentId: categoryData.parentId,
							tenantId: tenantId,
							isDeleted: false,
							_id: { $ne: categoryId }, // Exclude the deleted category
						},
						['_id']
					)

					await projectCategoriesQueries.updateMany(
						{ _id: categoryData.parentId },
						{ hasChildCategories: siblings && siblings.length > 0 }
					)
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_DELETED,
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}

	/**
	 * Get library category.
	 * @method
	 * @name details
	 * @param {Object} filterQuery - filter query
	 * @param {Object} userDetails - user details
	 * @returns {Object} Category result
	 */
	static details(filterQuery, userDetails) {
		return new Promise(async (resolve, reject) => {
			try {
				let tenantId = userDetails.userInformation.tenantId
				let organizationId = userDetails.userInformation.organizationId

				let matchQuery = {
					_id: filterQuery._id,
					tenantId: tenantId,
					status: CONSTANTS.common.ACTIVE_STATUS,
					isDeleted: false,
				}

				let categoryData = await projectCategoriesQueries.categoryDocuments(matchQuery, 'all')

				if (!categoryData || categoryData.length === 0) {
					throw {
						status: HTTP_STATUS_CODE.not_found.status,
						message: CONSTANTS.apiResponses.CATEGORY_NOT_FOUND,
					}
				}

				// If getChildren is true, fetch immediate children
				if (filterQuery.getChildren) {
					let childrenQuery = {
						parentId: filterQuery._id,
						tenantId: tenantId,
						status: CONSTANTS.common.ACTIVE_STATUS,
						isDeleted: false,
					}

					const skipFields = ['__v', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy']
					let children = await projectCategoriesQueries.categoryDocuments(childrenQuery, 'all', skipFields)

					categoryData[0].children = children
				}

				return resolve({
					success: true,
					message: CONSTANTS.apiResponses.PROJECT_CATEGORIES_FETCHED,
					data: categoryData[0],
				})
			} catch (error) {
				return resolve({
					success: false,
					message: error.message,
					data: {},
				})
			}
		})
	}
}

/**
 * Handle evidence upload
 * @name handleEvidenceUpload
 * @param {Array} files - files
 * @returns {Array} returns evidences array
 */

function handleEvidenceUpload(files, userId) {
	return new Promise(async (resolve, reject) => {
		try {
			let evidences = []
			if (files && files.cover_image) {
				let coverImages = files.cover_image

				if (!Array.isArray(coverImages)) {
					coverImages = [coverImages]
				}
				// Generate a unique ID for the file upload
				let uniqueId = await UTILS.generateUniqueId()

				// Prepare the request data for the file upload
				let requestData = {
					[uniqueId]: {
						files: [],
					},
				}

				for (let file of coverImages) {
					requestData[uniqueId].files.push(file.name)
				}

				let signedUrl = await filesHelpers.preSignedUrls(requestData, userId, false)

				if (
					signedUrl.data &&
					Object.keys(signedUrl.data).length > 0 &&
					signedUrl.data[uniqueId].files.length > 0 &&
					signedUrl.data[uniqueId].files[0].url &&
					signedUrl.data[uniqueId].files[0].url !== ''
				) {
					for (let fileFromRequest of coverImages) {
						let fileUploadUrl = signedUrl.data[uniqueId].files.filter((fileData) => {
							return fileData.file == fileFromRequest.name
						})

						// Upload evidences to cloud
						const uploadData = await axios.put(fileUploadUrl[0].url, fileFromRequest.data, {
							headers: {
								'x-ms-blob-type': process.env.CLOUD_STORAGE_PROVIDER === 'azure' ? 'BlockBlob' : null,
								'Content-Type': 'multipart/form-data',
							},
						})

						// Throw error if evidence upload fails
						if (!(uploadData.status == 200 || uploadData.status == 201)) {
							throw {
								success: false,
								message: CONSTANTS.apiResponses.FAILED_TO_UPLOAD,
							}
						}
					}
				}

				// Attach sequence number to each evidence.
				let sequenceNumber = 0
				evidences = signedUrl.data[uniqueId].files.map((fileInfo) => {
					return {
						title: fileInfo.file,
						filepath: fileInfo.payload.sourcePath,
						type: fileInfo.file.split('.').reverse()[0],
						sequence: ++sequenceNumber,
					}
				})
			}

			return resolve({
				success: true,
				data: evidences,
			})
		} catch (error) {
			return reject({
				status: error.status ? error.status : HTTP_STATUS_CODE.internal_server_error.status,
				success: false,
				message: error.message,
				data: {},
			})
		}
	})
}

/**
 * Helper to build visibility conditions and mutate matchQuery
 * @name applyVisibilityConditions
 * @param {Object} matchQuery - matchQuery
 * @param {Object} orgExtension - orgExtension
 * @param {Object} userDetails - userDetails
 * @returns {Object} returns modified matchQuery
 */
/**
 *
	Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = CURRENT
	{
		"$match": {
			"status": "published",
			"isReusable": true,
			"tenantId": "shikshalokam",
			"orgId": "slorg"
		}
	}
 */
/**
 *
	Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = ASSOCIATED
	{
		"$match": {
			"status": "published",
			"isReusable": true,
			"tenantId": "shikshalokam",
			"$and": [
				{
				"$or": [
					{
						"visibility": {
							"$ne": "CURRENT"
						},
						"visibleToOrganizations": {
							"$in": [
								"sot"
							]
						}
					},
					{
						"orgId": "sot"
					}
				]
				}
			]
		}
	}
 */
/**
 *
	Sample for matchQuery obj when orgExtension.externalProjectResourceVisibilityPolicy = ALL
	{
		"$match": {
		"status": "published",
		"isReusable": true,
		"tenantId": "shikshalokam",
		"$and": [
			{
			"$or": [
				{
					"visibility": "ALL"
				},
				{
					"visibility": {
						"$ne": "CURRENT"
					},
					"visibleToOrganizations": {
						"$in": [
							"mys"
						]
					}
				},
				{
					"orgId": "mys"
				}
			]
			}
		]
		}
	}
*/
function applyVisibilityConditions(matchQuery, orgExtension, userDetails) {
	let matchConditions = []

	// allow ALL templates
	if (
		orgExtension &&
		orgExtension.externalProjectResourceVisibilityPolicy === CONSTANTS.common.ORG_EXTENSION_VISIBILITY.ALL
	) {
		matchConditions.push({ visibility: CONSTANTS.common.ORG_EXTENSION_VISIBILITY.ALL })
	}

	// allow ASSOCIATED templates with orgId match (for both ALL and ASSOCIATED cases)
	if (
		orgExtension &&
		[CONSTANTS.common.ORG_EXTENSION_VISIBILITY.ALL, CONSTANTS.common.ORG_EXTENSION_VISIBILITY.ASSOCIATED].includes(
			orgExtension.externalProjectResourceVisibilityPolicy
		)
	) {
		matchConditions.push({
			visibility: { $ne: CONSTANTS.common.ORG_EXTENSION_VISIBILITY.CURRENT },
			visibleToOrganizations: {
				$in: [userDetails.userInformation.organizationId],
			},
		})
	}

	// Build a single `$or` array for visibility, then add it into `$and`
	const visibilityOr =
		matchConditions.length > 0 ? [...matchConditions, { orgId: userDetails.userInformation.organizationId }] : null
	if (visibilityOr) {
		// Preserve any existing $and clauses and append the visibility OR
		matchQuery.$match.$and = [...(matchQuery.$match.$and || []), { $or: visibilityOr }]
	} else {
		// Fallback to a simple orgId match when there are no other visibility conditions
		matchQuery.$match.orgId = userDetails.userInformation.organizationId
	}
	return matchQuery
}
