/**
 * name : entity-management.js
 * author : prajwal
 * Date : 18-Apr-2024
 * Description : Entity service related information.
 */

//dependencies
const request = require('request')
const fs = require('fs')

const interfaceServiceUrl = process.env.INTERFACE_SERVICE_URL

/**
 * List of entity data.
 * @function
 * @name entityDocuments
 * @param {Object} filterData - Filter data.
 * @param {Array} projection - Projected data.
 * @param {number} page - The page number for pagination.
 * @param {number} limit - The maximum number of results per page.
 * @param {String} search - Text string used for filtering entities using a search.
 * @param {String} aggregateValue - Path to the field to aggregate (e.g., 'groups.school') used for grouping or lookups.
 * @param {Boolean} isAggregateStaging - Flag indicating whether aggregation stages should be used in the pipeline (true = include stages).
 * @param {Boolean} isSort - Flag indicating whether sorting is required within the aggregation pipeline.
 * @param {Array<Object>} aggregateProjection - Array of projection fields to apply within the aggregation pipeline (used when `isAggregateStaging` is true).
 * @returns {JSON} - List of entity data.
 */

// Function to find entity documents based on the given filter and projection
const entityDocuments = function (
	filterData = 'all',
	projection = 'all',
	page = null,
	limit = null,
	search = '',
	aggregateValue = null,
	isAggregateStaging = false,
	isSort = true,
	aggregateProjection = []
) {
	return new Promise(async (resolve, reject) => {
		try {
			// Function to find entity documents based on the given filter and projection
			const url =
				interfaceServiceUrl +
				process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL +
				CONSTANTS.endpoints.FIND_ENTITY_DOCUMENTS +
				`?page=${page}&limit=${limit}&search=${search}&aggregateValue=${aggregateValue}&aggregateStaging=${isAggregateStaging}&aggregateSort=${isSort}`

			if (filterData._id && Array.isArray(filterData._id) && filterData._id.length > 0) {
				filterData['_id'] = {
					$in: filterData._id,
				}
			}

			let requestJSON = {
				query: filterData,
				projection: projection,
				aggregateProjection: aggregateProjection,
			}

			// Set the options for the HTTP POST request
			const options = {
				headers: {
					'content-type': 'application/json',
					'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
				},
				json: requestJSON,
			}
			// Make the HTTP POST request to the entity management service
			request.post(url, options, requestCallBack)

			// Callback function to handle the response from the HTTP POST request
			function requestCallBack(err, data) {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = data.body
					// Check if the response status is OK (HTTP 200)
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}

				return resolve(result)
			}
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * List of entity data.
 * @function
 * @name entityDocuments
 * @param {Object} filterData - Filter data.
 * @param {Array} projection - Projected data.
 * @returns {JSON} - List of entity data.
 */

// Function to find entity type documents based on the given filter, projection, and user token
const entityTypeDocuments = function (filterData = 'all', projection = 'all', userToken) {
	return new Promise(async (resolve, reject) => {
		try {
			// Construct the URL for the entity management service
			const url =
				interfaceServiceUrl +
				process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL +
				CONSTANTS.endpoints.FIND_ENTITY_TYPE_DOCUMENTS
			// Set the options for the HTTP POST request
			const options = {
				headers: {
					'content-type': 'application/json',
					'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
				},
				json: {
					query: filterData,
					projection: projection,
				},
			}

			// Make the HTTP POST request to the entity management service
			request.post(url, options, requestCallBack)

			// Callback function to handle the response from the HTTP POST request
			function requestCallBack(err, data) {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = data.body
					// Check if the response status is OK (HTTP 200)
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}

				return resolve(result)
			}
		} catch (error) {
			return reject(error)
		}
	})
}

// Function to find userRoleExtensiopn documents based on the given filter, projection, and user token
const getUserRoleExtensionDocuments = function (filterData = 'all', projection = 'all', userToken) {
	return new Promise(async (resolve, reject) => {
		try {
			// Construct the URL for the entity management service
			const url =
				interfaceServiceUrl +
				process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL +
				CONSTANTS.endpoints.FIND_USER_ROLE_EXTENSION_DOCUMENTS
			// Set the options for the HTTP POST request
			const options = {
				headers: {
					'content-type': 'application/json',
					'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
				},
				json: {
					query: filterData,
					projection: projection,
				},
			}

			// Make the HTTP POST request to the entity management service
			request.post(url, options, requestCallBack)

			// Callback function to handle the response from the HTTP POST request
			function requestCallBack(err, data) {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = data.body
					// Check if the response status is OK (HTTP 200)
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}

				return resolve(result)
			}
		} catch (error) {
			return reject(error)
		}
	})
}
/**
 * @method
 * @name findEntityDetails
 * @param {String} tenantId - tenantId
 * @param {String} entityIdentifier - entityIdentifier can be a mongoId or entity externalId
 * @returns {Object} - entity details
 */
// Function to find the details of a given entity ant the tenant it belongs under
const findEntityDetails = function (tenantId, entityIdentifier) {
	return new Promise(async (resolve, reject) => {
		try {
			// Define the URL for the user role extension API
			const url = `${interfaceServiceUrl}${process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL}${CONSTANTS.endpoints.FIND_ENTITY_DETAILS}/${entityIdentifier}`

			// Set the options for the HTTP POST request
			const options = {
				headers: {
					'content-type': 'application/json',
					tenantId: tenantId,
				},
			}

			// Make the HTTP POST request to the user role extension API
			request.get(url, options, requestCallBack)

			// Callback function to handle the response from the HTTP POST request
			function requestCallBack(err, data) {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = JSON.parse(data.body)
					// Check if the response status is OK (HTTP 200)
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}

				return resolve(result)
			}
		} catch (error) {
			return reject(error)
		}
	})
}

const findEntities = function (
	tenantId,
	userIds,
	findBy,
	projection = ['_id', 'metaInformation.name', 'metaInformation.externalId']
) {
	return new Promise(async (resolve, reject) => {
		try {
			const url = `${process.env.ENTITY_BASE_URL}${process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL}${CONSTANTS.endpoints.FIND_ENTITY_DOCUMENTS}`
			const options = {
				headers: {
					'content-type': 'application/json',
					'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
				},
				json: {
					query: {
						tenantId: tenantId,
						[findBy]: { $in: userIds },
					},
					projection: projection,
				},
			}

			request.post(url, options, requestCallBack)
			function requestCallBack(err, data) {
				let result = {
					success: true,
				}
				if (err) {
					result.success = false
				} else {
					let response = data.body
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}
				return resolve(result)
			}
		} catch (error) {
			return reject(error)
		}
	})
}
const addEntity = function (requestBody, entityType, userToken, tenantId, orgId) {
	return new Promise(async (resolve, reject) => {
		try {
			const url = `${process.env.ENTITY_BASE_URL}${process.env.ENTITY_MANAGEMENT_SERVICE_BASE_URL}${CONSTANTS.endpoints.ADD_ENTITY}?type=${entityType}`
			const options = {
				headers: {
					'content-type': 'application/json',
					'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
					'x-auth-token': userToken,
					'admin-access-token': process.env.ADMIN_ACCESS_TOKEN,
					tenantId: tenantId,
					orgId: orgId,
				},
				json: requestBody,
			}
			request.post(url, options, (err, data) => {
				let result = {
					success: true,
				}
				if (err) {
					result.success = false
				} else {
					let response = data.body
					if (response.status === HTTP_STATUS_CODE.ok.status) {
						result['data'] = response.result
					} else {
						result.success = false
					}
				}
				return resolve(result)
			})
		} catch (error) {
			return reject(error)
		}
	})
}
module.exports = {
	entityDocuments: entityDocuments,
	entityTypeDocuments: entityTypeDocuments,
	getUserRoleExtensionDocuments: getUserRoleExtensionDocuments,
	findEntityDetails: findEntityDetails,
	findEntities: findEntities,
	addEntity: addEntity,
}
