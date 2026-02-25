/**
 * name : authenticator.js
 * author : vishnu
 * Date : 05-Aug-2020
 * Description : Authentication middleware.
 */

// dependencies
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const isBearerRequired = process.env.IS_AUTH_TOKEN_BEARER === 'true'
const userService = require('../services/users')
const requests = require('../helpers/requests')

var respUtil = function (resp) {
	return {
		status: resp.errCode,
		message: resp.errMsg,
		currentDate: new Date().toISOString(),
	}
}

var removedHeaders = [
	'host',
	// 'origin',
	'accept',
	'referer',
	'content-length',
	'accept-encoding',
	'accept-language',
	'accept-charset',
	'cookie',
	'dnt',
	'postman-token',
	'cache-control',
	'connection',
]

module.exports = async function (req, res, next, token = '') {
	removedHeaders.forEach(function (e) {
		delete req.headers[e]
	})

	if (!req.rspObj) req.rspObj = {}
	var rspObj = req.rspObj

	token = req.headers['x-auth-token']

	// Allow search endpoints for non-logged in users.
	let guestAccess = false
	let guestAccessPaths = [
		'/dataPipeline/',
		'userProjects/certificateCallback',
		'userProjects/certificateCallbackError',
		'cloud-services/files/download',
	]
	await Promise.all(
		guestAccessPaths.map(async function (path) {
			if (req.path.includes(path)) {
				guestAccess = true
			}
		})
	)

	if (guestAccess == true && !token) {
		next()
		return
	}

	let internalAccessApiPaths = [
		'/templates/bulkCreate',
		'/templates/update',
		'/projectAttributes/update',
		'/scp/publishTemplateAndTasks',
		'/library/categories/create',
		'/library/categories/update',
		'/library/categories/delete',
		'/programs/create',
		'/programs/update',
		'/programs/read',
		'/admin/createIndex',
		'/solutions/create',
		'/solutions/update',
		'/forms/create',
		'/forms/update',
		'/templateTasks/bulkCreate',
		'/certificateBaseTemplates/createOrUpdate',
		'/certificateTemplates/createOrUpdate',
		'/certificateTemplates/uploadTemplate',
		'/certificateTemplates/createSvg',
		'/solutions/getDetails',
		'/userProjects/deleteUserPIIData',
		'/programs/addEntitiesInScope',
		'/programs/removeRolesInScope',
		'/programs/removeEntitiesInScope',
		'/programs/addRolesInScope',
		'/solutions/addEntitiesInScope',
		'/solutions/removeRolesInScope',
		'/solutions/removeEntitiesInScope',
		'/solutions/addRolesInScope',
		'/templateTasks/update',
		'/projectAttributes/create',
		'/projectAttributes/update',
		'/userExtension/bulkUpload',
		'/userProjects/pushSubmissionToTask',
		'/templates/importProjectTemplate',
		'/templates/listByIds',
		'/admin/deleteResource',
		'/programs/removeSolutions',
		'/templates/createChildProjectTemplate',
		'/organizationExtension/createOrUpdate',
		'/organizationExtension/updateRelatedOrgs',
		'/userExtension/update',
		'/solutions/fetchLinkInternal',
		//'/programUsers/createOrUpdate',
	]
	let performInternalAccessTokenCheck = false
	let adminHeader = false
	if (process.env.ADMIN_ACCESS_TOKEN) {
		adminHeader = req.headers[process.env.ADMIN_TOKEN_HEADER_NAME]
	}

	await Promise.all(
		internalAccessApiPaths.map(async function (path) {
			if (req.path.includes(path)) {
				performInternalAccessTokenCheck = true
			}
		})
	)
	if (performInternalAccessTokenCheck) {
		if (req.headers['internal-access-token'] !== process.env.INTERNAL_ACCESS_TOKEN) {
			rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
			rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
			rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
			return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
		}
		if (!token) {
			next()
			return
		}
	}
	if (!token) {
		rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
		rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
		rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
		return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
	}

	// Check if a Bearer token is required for authentication
	if (isBearerRequired) {
		const [authType, extractedToken] = token.split(' ')
		if (authType.toLowerCase() !== 'bearer') {
			rspObj.errCode = CONSTANTS.apiResponses.TOKEN_INVALID_CODE
			rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_INVALID_MESSAGE
			rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
			return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
		}
		token = extractedToken?.trim()
	} else {
		token = token?.trim()
	}

	rspObj.errCode = CONSTANTS.apiResponses.TOKEN_INVALID_CODE
	rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_INVALID_MESSAGE
	rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status

	// <---- For Elevate user service user compactibility ---->
	let errdecodedToken = null
	let userInformation = {}
	try {
		if (process.env.AUTH_METHOD === CONSTANTS.common.AUTH_METHOD.NATIVE) {
			try {
				// If using native authentication, verify the JWT using the secret key
				decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
			} catch (err) {
				// If verification fails, send an unauthorized response
				rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
				return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
			}
		} else if (process.env.AUTH_METHOD === CONSTANTS.common.AUTH_METHOD.KEYCLOAK_PUBLIC_KEY) {
			// If using Keycloak with a public key for authentication
			const keycloakPublicKeyPath = `${process.env.KEYCLOAK_PUBLIC_KEY_PATH}/`
			const PEM_FILE_BEGIN_STRING = '-----BEGIN PUBLIC KEY-----'
			const PEM_FILE_END_STRING = '-----END PUBLIC KEY-----'

			// Decode the JWT to extract its claims without verifying
			const tokenClaims = jwt.decode(token, { complete: true })

			if (!tokenClaims || !tokenClaims.header) {
				// If the token does not contain valid claims or header, send an unauthorized response
				rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
				return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
			}

			// Extract the key ID (kid) from the token header
			const kid = tokenClaims.header.kid

			// Construct the path to the public key file using the key ID
			let filePath = path.resolve(__dirname, keycloakPublicKeyPath, kid.replace(/\.\.\//g, ''))

			// Read the public key file from the resolved file path
			const accessKeyFile = await fs.promises.readFile(filePath, 'utf8')

			// Ensure the public key is properly formatted with BEGIN and END markers
			const cert = accessKeyFile.includes(PEM_FILE_BEGIN_STRING)
				? accessKeyFile
				: `${PEM_FILE_BEGIN_STRING}\n${accessKeyFile}\n${PEM_FILE_END_STRING}`
			let verifiedClaims
			try {
				// Verify the JWT using the public key and specified algorithms
				verifiedClaims = jwt.verify(token, cert, { algorithms: ['sha1', 'RS256', 'HS256'] })
			} catch (err) {
				// If the token is expired or any other error occurs during verification
				if (err.name === 'TokenExpiredError') {
					rspObj.errCode = CONSTANTS.apiResponses.TOKEN_INVALID_CODE
					rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_INVALID_MESSAGE
					rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
					return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
				}
			}

			// Extract the external user ID from the verified claims
			const externalUserId = verifiedClaims.sub.split(':').pop()

			const data = {
				id: externalUserId,
				// roles: roles,
				name: verifiedClaims.name,
				organization_id: verifiedClaims.org || null,
			}

			// Ensure decodedToken is initialized as an object
			decodedToken = decodedToken || {}
			decodedToken['data'] = data
		}

		if (!decodedToken) {
			rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
			rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
			rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
			return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
		}

		if (
			!performInternalAccessTokenCheck &&
			process.env.SESSION_VERIFICATION_METHOD === CONSTANTS.common.SESSION_VERIFICATION_METHOD.USER_SERVICE
		) {
			try {
				const userSession = await validateSession(token)
				if (!userSession.success) {
					throw {
						message: userSession.message,
						status: userSession.status,
					}
				}
			} catch (error) {
				rspObj.errCode = error.status || CONSTANTS.apiResponses.USER_SERVICE_DOWN_CODE
				rspObj.errMsg = error.message || CONSTANTS.apiResponses.USER_SERVICE_DOWN
				rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
				return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
			}
		}

		// Path to config.json
		let configFilePath
		if (process.env.AUTH_CONFIG_FILE_PATH) {
			configFilePath = path.resolve(PROJECT_ROOT_DIRECTORY, process.env.AUTH_CONFIG_FILE_PATH)
		}

		// Initialize variables
		let configData = {}
		let defaultTokenExtraction = false

		// Check if config.json exists
		if (fs.existsSync(configFilePath)) {
			// Read and parse the config.json file
			const rawData = fs.readFileSync(configFilePath)
			try {
				configData = JSON.parse(rawData)
				if (!configData.authTokenUserInformation) {
					defaultTokenExtraction = true
				}
				configData = configData.authTokenUserInformation
			} catch (error) {
				console.error('Error parsing config.json:', error)
			}
		} else {
			// If file doesn't exist, set defaultTokenExtraction to false
			defaultTokenExtraction = true
		}

		let organizationKey = 'organization_id'

		// Create user details to request
		req.userDetails = {
			userToken: token,
		}

		// performing default token data extraction
		if (defaultTokenExtraction) {
			if (!decodedToken.data.organization_ids || !decodedToken.data.tenant_id) {
				rspObj.errCode = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
				return res.status(HTTP_STATUS_CODE['bad_request'].status).send(respUtil(rspObj))
			}

			//here assuming that req.headers['orgid'] will be a single value if multiple passed first element of the array will be taken
			let fetchSingleOrgIdFunc = await fetchSingleOrgIdFromProvidedData(
				decodedToken.data.tenant_id.toString(),
				decodedToken.data.organization_ids,
				req.headers['orgid'],
				token
			)

			if (!fetchSingleOrgIdFunc.success) {
				return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(fetchSingleOrgIdFunc.errorObj))
			}
			userInformation = {
				userId:
					typeof decodedToken.data.id == 'string' ? decodedToken.data.id : decodedToken.data.id.toString(),
				userName: decodedToken.data.name,
				organizationId: fetchSingleOrgIdFunc.orgId,
				firstName: decodedToken.data.name,
				roles: decodedToken.data.roles.map((role) => role.title),
				tenantId: decodedToken.data.tenant_id.toString(),
			}
		} else {
			for (let key in configData) {
				if (configData.hasOwnProperty(key)) {
					let keyValue = getNestedValue(decodedToken, configData[key])
					if (key == 'userId') {
						keyValue = keyValue?.toString()
					}
					if (key === organizationKey) {
						let value = getOrgId(req.headers, decodedToken, configData[key])
						userInformation[`organizationId`] = value.toString()
						decodedToken.data[key] = value
						continue
					}
					if (key === 'roles') {
						let orgId = getOrgId(req.headers, decodedToken, configData[organizationKey])
						// Now extract roles using fully dynamic path
						const rolePathTemplate = configData['roles']
						decodedToken.data[organizationKey] = orgId
						const resolvedRolePath = resolvePathTemplate(rolePathTemplate, decodedToken.data)
						const roles = getNestedValue(decodedToken, resolvedRolePath) || []
						userInformation[`${key}`] = roles
						decodedToken.data[key] = roles
						continue
					}

					// For each key in config, assign the corresponding value from decodedToken
					decodedToken.data[key] = keyValue
					if (key == 'tenant_id') {
						userInformation[`tenantId`] = keyValue.toString()
					} else {
						userInformation[`${key}`] = keyValue
					}
				}
			}
			if (userInformation.roles && Array.isArray(userInformation.roles) && userInformation.roles.length) {
				userInformation.roles = userInformation.roles.map((role) => role.title)
			}
		}

		// throw error if tenant_id or organization_id is not present in the decoded token
		if (
			!decodedToken.data.tenant_id ||
			!(decodedToken.data.tenant_id.toString().length > 0) ||
			!decodedToken.data.organization_id ||
			!(decodedToken.data.organization_id.toString().length > 0)
		) {
			rspObj.errCode = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
			rspObj.errMsg = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_MESSAGE
			rspObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
			return res.status(HTTP_STATUS_CODE['bad_request'].status).send(respUtil(rspObj))
		}

		/**
		 * Validate if provided orgId(s) belong to the tenant by checking against related_orgs.
		 *
		 * @param {String} tenantId - ID of the tenant
		 * @param {String} orgId - Comma separated string of org IDs or 'ALL'
		 * @returns {Object} - Success with validOrgIds array or failure with error object
		 */
		async function validateIfOrgsBelongsToTenant(tenantId, orgId, token) {
			let orgIdArr = Array.isArray(orgId) ? orgId : typeof orgId === 'string' ? orgId.split(',') : []
			let orgDetails = await userService.fetchTenantDetails(tenantId, token)
			let validOrgIds = null

			if (
				!orgDetails ||
				!orgDetails.success ||
				!orgDetails.data ||
				!(Object.keys(orgDetails.data).length > 0) ||
				!orgDetails.data.organizations ||
				!(orgDetails.data.organizations.length > 0)
			) {
				let errorObj = {}
				errorObj.errCode = CONSTANTS.apiResponses.ORG_DETAILS_FETCH_UNSUCCESSFUL_CODE
				errorObj.errMsg = CONSTANTS.apiResponses.ORG_DETAILS_FETCH_UNSUCCESSFUL_MESSAGE
				errorObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
				return { success: false, errorObj: errorObj }
			}

			// convert the types of items to string
			orgDetails.data.related_orgs = orgDetails.data.organizations.map((data) => {
				return data.code.toString().toLowerCase()
			})
			// aggregate valid orgids

			let relatedOrgIds = orgDetails.data.related_orgs
			validOrgIds = orgIdArr.filter((id) => relatedOrgIds.includes(id))

			if (!(validOrgIds.length > 0)) {
				rspObj.errCode = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
				return res.status(HTTP_STATUS_CODE['bad_request'].status).send(respUtil(rspObj))
			}

			return { success: true, validOrgIds: validOrgIds }
		}

		/**
		 * Fetches a valid orgId from the provided data, checking if it's valid for the given tenant.
		 *
		 * @param {String} tenantId - ID of the tenant
		 * @param {String[]} orgIdArr - Array of orgIds to choose from
		 * @param {String} orgIdFromHeader - The orgId provided in the request headers
		 * @returns {Promise<Object>} - Returns a promise resolving to an object containing the success status, orgId, or error details
		 */
		async function fetchSingleOrgIdFromProvidedData(tenantId, orgIdArr, orgIdFromHeader, token) {
			try {
				// Check if orgIdFromHeader is provided and valid
				if (orgIdFromHeader && orgIdFromHeader != '') {
					if (!orgIdArr.includes(orgIdFromHeader)) {
						throw CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
					}

					let validateOrgsResult = await validateIfOrgsBelongsToTenant(tenantId, orgIdFromHeader, token)

					if (!validateOrgsResult.success) {
						throw CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
					}

					return { success: true, orgId: orgIdFromHeader }
				}

				// If orgIdFromHeader is not provided, check orgIdArr
				if (orgIdArr.length > 0) {
					return { success: true, orgId: orgIdArr[0] }
				}

				// If no orgId is found, throw error
				throw CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
			} catch (err) {
				// Handle error when no valid orgId is found
				if (orgIdArr.length > 0) {
					return { success: true, orgId: orgIdArr[0] }
				}

				rspObj.errCode = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TENANTID_AND_ORGID_REQUIRED_IN_TOKEN_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
				return res.status(HTTP_STATUS_CODE['bad_request'].status).send(respUtil(rspObj))
			}
		}

		/**
		 * Extract tenantId and orgId from incoming request or decoded token.
		 *
		 * Priority order: body -> query -> headers -> decoded token data
		 *
		 * @param {Object} req - Express request object
		 * @param {Object} decodedTokenData - Decoded JWT token data
		 * @returns {Object} - Success with tenantId and orgId or failure object
		 */
		function getTenantIdAndOrgIdFromTheTheReqIntoHeaders(req, decodedTokenData) {
			// Step 1: Check in the request body
			if (req.body && req.body.tenantId && req.body.orgId) {
				return { success: true, tenantId: req.body.tenantId, orgId: req.body.orgId }
			}

			// Step 2: Check in query parameters if not found in body
			if (req.query.tenantId && req.query.orgId) {
				return { success: true, tenantId: req.query.tenantId, orgId: req.query.orgId }
			}

			// Step 3: Check in headers if not found in query params
			if (req.headers['tenantid'] && req.headers['orgid']) {
				return { success: true, tenantId: req.headers['tenantid'], orgId: req.headers['orgid'] }
			}

			// Step 4: Check in user token (already decoded) if still not found
			if (decodedTokenData && decodedTokenData.tenantId && decodedTokenData.orgId) {
				return { success: true, tenantId: decodedTokenData.tenantId, orgId: decodedTokenData.orgId }
			}

			return { sucess: false }
		}

		let userRoles = decodedToken.data.roles.map((role) => role.title)
		if (performInternalAccessTokenCheck) {
			decodedToken.data['tenantAndOrgInfo'] = {}
			// validate SUPER_ADMIN
			if (adminHeader) {
				if (adminHeader != process.env.ADMIN_ACCESS_TOKEN) {
					return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
				}
				decodedToken.data.roles.push({ title: CONSTANTS.common.ADMIN_ROLE })

				let result = getTenantIdAndOrgIdFromTheTheReqIntoHeaders(req, decodedToken.data)
				if (!result.success) {
					rspObj.errCode = CONSTANTS.apiResponses.ADMIN_TOKEN_MISSING_CODE
					rspObj.errMsg = CONSTANTS.apiResponses.ADMIN_TOKEN_MISSING_MESSAGE
					rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
					return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
				}
				result = convertTenantAndOrgToLowercase(result)
				req.headers['tenantid'] = result.tenantId
				req.headers['orgid'] = result.orgId

				let validateOrgsResult = await validateIfOrgsBelongsToTenant(
					req.headers['tenantid'],
					req.headers['orgid'],
					token
				)

				if (!validateOrgsResult.success) {
					return res
						.status(HTTP_STATUS_CODE['unauthorized'].status)
						.send(respUtil(validateOrgsResult.errorObj))
				}

				req.headers['orgid'] = validateOrgsResult.validOrgIds
			} else if (userRoles.includes(CONSTANTS.common.TENANT_ADMIN)) {
				req.headers['tenantid'] = UTILS.lowerCase(decodedToken.data.tenant_id.toString())

				let orgId = req.body.orgId || req.headers['orgid']

				if (!orgId) {
					rspObj.errCode = CONSTANTS.apiResponses.INVALID_TENANT_AND_ORG_CODE
					rspObj.errMsg = CONSTANTS.apiResponses.INVALID_TENANT_AND_ORG_MESSAGE
					rspObj.responseCode = HTTP_STATUS_CODE['bad_request'].status
					return res.status(HTTP_STATUS_CODE['bad_request'].status).send(respUtil(rspObj))
				}

				req.headers['orgid'] = Array.isArray(orgId)
					? orgId.map((org) => UTILS.lowerCase(org))
					: UTILS.lowerCase(orgId)

				let validateOrgsResult = await validateIfOrgsBelongsToTenant(
					req.headers['tenantid'],
					req.headers['orgid'],
					token
				)
				if (!validateOrgsResult.success) {
					return res
						.status(HTTP_STATUS_CODE['unauthorized'].status)
						.send(respUtil(validateOrgsResult.errorObj))
				}
				req.headers['orgid'] = validateOrgsResult.validOrgIds
			} else if (userRoles.includes(CONSTANTS.common.ORG_ADMIN)) {
				req.headers['tenantid'] = UTILS.lowerCase(decodedToken.data.tenant_id.toString())
				req.headers['orgid'] = [UTILS.lowerCase(decodedToken.data.organization_id.toString())]
			} else {
				rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
				rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
				rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
				return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
			}

			decodedToken.data.tenantAndOrgInfo['tenantId'] = req.headers['tenantid'].toString()
			decodedToken.data.tenantAndOrgInfo['orgId'] = req.headers['orgid']
		}
	} catch (err) {
		rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
		rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
		rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
		return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
	}
	if (!decodedToken) {
		rspObj.errCode = CONSTANTS.apiResponses.TOKEN_MISSING_CODE
		rspObj.errMsg = CONSTANTS.apiResponses.TOKEN_MISSING_MESSAGE
		rspObj.responseCode = HTTP_STATUS_CODE['unauthorized'].status
		return res.status(HTTP_STATUS_CODE['unauthorized'].status).send(respUtil(rspObj))
	}

	// Update user details object
	req.userDetails.userInformation = userInformation
	if (decodedToken.data.tenantAndOrgInfo) {
		req.userDetails.tenantAndOrgInfo = decodedToken.data.tenantAndOrgInfo
	}

	// Helper function to access nested properties
	function getOrgId(headers, decodedToken, orgConfigData) {
		if (headers['orgId']) {
			return (orgId = headers['orgId'].toString())
		} else {
			const orgIdPath = orgConfigData
			return (orgId = getNestedValue(decodedToken, orgIdPath)?.toString())
		}
	}

	function getNestedValue(obj, path) {
		const parts = path.split('.')
		let current = obj

		for (const part of parts) {
			if (!current) return undefined

			// Conditional match: key[?field=value]
			const conditionalMatch = part.match(/^(\w+)\[\?(\w+)=([^\]]+)\]$/)
			if (conditionalMatch) {
				const [, arrayKey, field, expected] = conditionalMatch
				const array = current[arrayKey]
				if (!Array.isArray(array)) return undefined
				const found = array.find((item) => String(item[field]) === String(expected))
				if (!found) return undefined
				current = found
				continue
			}

			// Index match: key[0]
			const indexMatch = part.match(/^(\w+)\[(\d+)\]$/)
			if (indexMatch) {
				const [, key, index] = indexMatch
				const array = current[key]
				if (!Array.isArray(array)) return undefined
				current = array[parseInt(index, 10)]
				continue
			}

			current = current[part]
		}
		return current
	}

	function resolvePathTemplate(template, contextObject) {
		return template.replace(/\{\{(.*?)\}\}/g, (_, path) => {
			const value = getNestedValue(contextObject, path.trim())
			return value?.toString?.() ?? ''
		})
	}

	/**
	 *
	 * @function
	 * @name convertTenantAndOrgToLowercase
	 * @param {Object} result - The result object containing success flag, tenantId, and orgId.
	 * @param {Boolean} result.success - Indicates whether the operation was successful.
	 * @param {String} result.tenantId - Tenant ID to be converted to lowercase.
	 * @param {String} result.orgId - Organization ID to be converted to lowercase.
	 * @returns {Object} Returns the modified result object with tenantId and orgId in lowercase,
	 *                   or the original result object if conditions are not met.
	 */
	function convertTenantAndOrgToLowercase(result) {
		if (result?.success && result.tenantId && result.orgId) {
			const tenantId = UTILS.lowerCase(result.tenantId)
			const orgId = Array.isArray(result.orgId)
				? result.orgId.map((org) => UTILS.lowerCase(org))
				: UTILS.lowerCase(result.orgId)
			return { ...result, tenantId, orgId }
		}
		return result
	}

	next()
}

/**
 * Validates the user's session token by calling the user service.
 * @param {string} token - The access token extracted from the request header.
 */

async function validateSession(token) {
	try {
		const userBaseUrl = `${process.env.INTERFACE_SERVICE_URL}${process.env.USER_SERVICE_BASE_URL}`
		const validateSessionEndpoint = `${userBaseUrl}${CONSTANTS.endpoints.VALIDATE_SESSIONS}`
		const reqBody = { token }

		const isSessionActive = await requests.post(
			validateSessionEndpoint,
			reqBody,
			'',
			true,
			process.env.USER_SERVICE_INTERNAL_ACCESS_TOKEN_HEADER_KEY
		)

		// Case 1: Unauthorized token
		if (isSessionActive?.data?.responseCode === 'UNAUTHORIZED') {
			throw {
				status: CONSTANTS.apiResponses.ACCESS_TOKEN_EXPIRED_CODE,
				message: CONSTANTS.apiResponses.ACCESS_TOKEN_EXPIRED,
			}
		}
		// Case 2: User service down / session inactive
		if (!isSessionActive?.success || !isSessionActive?.data?.result?.data?.user_session_active) {
			throw {
				status: CONSTANTS.apiResponses.USER_SERVICE_DOWN_CODE,
				message: CONSTANTS.apiResponses.USER_SERVICE_DOWN,
			}
		}

		return isSessionActive
	} catch (err) {
		return {
			success: false,
			status: err.status || CONSTANTS.apiResponses.USER_SERVICE_DOWN_CODE,
			message: err.message || CONSTANTS.apiResponses.USER_SERVICE_DOWN,
		}
	}
}
