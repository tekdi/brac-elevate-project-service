/**
 * name : envVariables.js.
 * author : Aman Karki.
 * created-date : 19-June-2020.
 * Description : Required Environment variables .
 */

const Log = require('log')
let log = new Log('debug')
let table = require('cli-table')

let tableData = new table()

let enviromentVariables = {
	APPLICATION_PORT: {
		message: 'Please specify the value for e.g. 4201',
		optional: false,
	},
	APPLICATION_ENV: {
		message: 'Please specify the value for e.g. local/development/qa/production',
		optional: false,
	},
	MONGODB_URL: {
		message: 'Required mongodb url',
		optional: false,
	},
	INTERNAL_ACCESS_TOKEN: {
		message: 'Required internal access token',
		optional: false,
	},
	GOTENBERG_URL: {
		message: 'Gotenberg url required',
		optional: false,
	},
	KAFKA_COMMUNICATIONS_ON_OFF: {
		message: 'Enable/Disable kafka communications',
		optional: false,
	},
	// "KAFKA_URL" : {
	//   "message" : "Required",
	//   "optional" : false
	// },
	SERVICE_NAME: {
		message: 'Project service name required',
		optional: false,
		default: 'project',
	},
	CERTIFICATE_SERVICE_URL: {
		message: 'certificate service base url',
		optional: true,
		default: 'http://registry-service:8081',
		requiredIf: {
			key: 'PROJECT_CERTIFICATE_ON_OFF',
			operator: 'EQUALS',
			value: 'ON',
		},
	},
	PROJECT_CERTIFICATE_ON_OFF: {
		message: 'Enable/Disable project certification',
		optional: false,
		default: 'ON',
	},
	CERTIFICATE_BASE_TEMPLATE_ID: {
		message:
			'Certificate base template id for project plan certificate (createProjectPlan). If set, a certificate template is created and linked to the solution.',
		optional: true,
	},
	ALLOW_CERTIFICATE_FOR_PRIVATE_PROGRAM: {
		message:
			'If "true", private program projects can have certificate (attach at creation and allow certificate generation). If not set or not "true", private program projects will not get certificate.',
		optional: true,
	},
	// cloud service variables
	CLOUD_STORAGE_PROVIDER: {
		message: 'Require cloud storage provider',
		optional: false,
	},
	CLOUD_STORAGE_BUCKETNAME: {
		message: 'Require client storage bucket name',
		optional: false,
	},
	CLOUD_STORAGE_SECRET: {
		message: 'Require client storage provider identity',
		optional: false,
	},
	CLOUD_STORAGE_ACCOUNTNAME: {
		message: 'Require client storage account name',
		optional: false,
	},
	ALLOWED_HOST: {
		message: 'Required CORS allowed host',
		optional: true,
		default: '*',
	},
	// signedUrl and downloadAble url expiry durations
	DOWNLOADABLE_URL_EXPIRY_IN_SECONDS: {
		message: 'Required downloadable url expiration time',
		optional: false,
		default: 300,
	},
	PRESIGNED_URL_EXPIRY_IN_SECONDS: {
		message: 'Required presigned url expiration time',
		optional: false,
		default: 300,
	},
	// default organisation code
	DEFAULT_ORGANISATION_CODE: {
		message: 'Default Organization Id/Code is required',
		optional: false,
	},
	APP_PORTAL_BASE_URL: {
		message: 'App Portal base url required',
		optional: false,
		default: 'https://dev.elevate.org',
	},
	APP_PORTAL_DIRECTORY: {
		message: 'App Portal base url required',
		optional: false,
		default: '/ml/',
	},
	TIMEZONE_DIFFRENECE_BETWEEN_LOCAL_TIME_AND_UTC: {
		message: 'Timezone diffrence required',
		optional: false,
	},
	ELEVATE_PROJECT_SERVICE_URL: {
		message: 'Elevate project service url required',
		optional: false,
	},
	API_DOC_URL: {
		message: 'Required api doc url',
		optional: false,
	},
	INTERFACE_SERVICE_URL: {
		message: 'Interface service url required',
		optional: false,
	},
	USER_SERVICE_BASE_URL: {
		message: 'User service name required',
		optional: false,
	},
	ENTITY_MANAGEMENT_SERVICE_BASE_URL: {
		message: 'Entity management service name required',
		optional: false,
	},
	SUBMISSION_LEVEL: {
		message: 'Project submission level required',
		optional: false,
		default: 'USER',
	},
	IS_AUTH_TOKEN_BEARER: {
		message: 'Required specification: If auth token is bearer or not',
		optional: true,
		default: false,
	},
	DEFAULT_PROJECT_CATEGORY: {
		message: 'Default category external-id required',
		optional: false,
		default: 'MI-2.0-default',
	},
	ENABLE_REFLECTION: {
		message: 'Enable reflection required',
		optional: false,
		default: 'false',
	},
	AUTH_METHOD: {
		message: 'Required authentication method',
		optional: true,
		default: CONSTANTS.common.AUTH_METHOD.NATIVE,
	},
	KEYCLOAK_PUBLIC_KEY_PATH: {
		message: 'Required Keycloak Public Key Path',
		optional: true,
		default: '../keycloakPublicKeys',
	},
	ORG_ID_HEADER_NAME: {
		message: 'Required OrgId header name',
		optional: false,
		default: 'org-id',
	},
	ADMIN_TOKEN_HEADER_NAME: {
		message: 'Required admin access token header name',
		optional: true,
		default: 'admin-auth-token',
	},
	ADMIN_ACCESS_TOKEN: {
		message: 'Required admin access token',
		optional: false,
	},
	USER_DELETE_ON_OFF: {
		message: 'Enable/Disable User data deletion',
		optional: true,
		default: 'ON',
	},
	USER_DELETE_TOPIC: {
		message: 'Required user data delete kafka topic',
		optional: true,
		requiredIf: {
			key: 'USER_DELETE_ON_OFF',
			operator: 'EQUALS',
			value: 'ON',
		},
	},
	AUTH_CONFIG_FILE_PATH: {
		message: 'Required auth config file',
		optional: true,
		default: 'config.json',
	},
	PROGRAM_USER_MAPPING_TOPIC: {
		message: 'Required program operation kafka topic',
		optional: true,
		default: CONSTANTS.common.DEFAULT_PROGRAM_USER_MAPPING_TOPIC,
	},
	SUBMISSION_TOPIC: {
		message: 'Required SUBMISSION_TOPIC',
		optional: true,
		default: 'elevate-improvement-project-submission-dev',
	},
	RESOURCE_DELETION_TOPIC: {
		message: 'Required RESOURCE_DELETION_TOPIC',
		optional: false,
		default: 'resource_deletion_topic',
	},
	USER_COURSES_SUBMISSION_TOPIC: {
		message: 'Required USER_COURSES_SUBMISSION_TOPIC',
		optional: true,
		default: 'elevate_user_courses_dev',
	},
	USER_COURSES_TOPIC: {
		message: 'Required USER_COURSES_TOPIC',
		optional: true,
		default: 'elevate_user_courses_raw',
	},
	KAFKA_HEALTH_CHECK_TOPIC: {
		message: 'Required KAFKA_HEALTH_CHECK_TOPIC',
		optional: false,
		default: 'project-health-check-topic-check',
	},
	ORG_UPDATES_TOPIC: {
		message: 'Required ORG_UPDATES_TOPIC',
		optional: true,
		default: 'elevate_project_org_extension_event_listener',
	},
	USER_ACCOUNT_EVENT_TOPIC: {
		message: 'Required USER_ACCOUNT_EVENT_TOPIC',
		optional: true,
		default: 'elevate_user_account_event_listener',
	},
	SESSION_VERIFICATION_METHOD: {
		message: 'Required Session Verification Method',
		optional: true,
		default: 'user_service_authenticated',
	},
	USER_SERVICE_INTERNAL_ACCESS_TOKEN_HEADER_KEY: {
		message: 'Required User Service Internal Access Token Header Key',
		optional: true,
		default: 'internal_access_token',
	},
	PUSH_SUBMISION_STATUS_TO_TASK: {
		message: 'If task is of observation type, along with submissions push the status to task',
		optional: true,
		default: 'false',
	},
	ENABLE_PROGRAM_USER_MAPPING: {
		message: 'If yes, then program user mapping will be updated',
		optional: true,
		default: 'false',
	},
}

let success = true

module.exports = function () {
	Object.keys(enviromentVariables).forEach((eachEnvironmentVariable) => {
		let tableObj = {
			[eachEnvironmentVariable]: 'PASSED',
		}

		let keyCheckPass = true
		let validRequiredIfOperators = ['EQUALS', 'NOT_EQUALS']

		if (
			enviromentVariables[eachEnvironmentVariable].optional === true &&
			enviromentVariables[eachEnvironmentVariable].requiredIf &&
			enviromentVariables[eachEnvironmentVariable].requiredIf.key &&
			enviromentVariables[eachEnvironmentVariable].requiredIf.key != '' &&
			enviromentVariables[eachEnvironmentVariable].requiredIf.operator &&
			validRequiredIfOperators.includes(enviromentVariables[eachEnvironmentVariable].requiredIf.operator) &&
			enviromentVariables[eachEnvironmentVariable].requiredIf.value &&
			enviromentVariables[eachEnvironmentVariable].requiredIf.value != ''
		) {
			switch (enviromentVariables[eachEnvironmentVariable].requiredIf.operator) {
				case 'EQUALS':
					if (
						process.env[enviromentVariables[eachEnvironmentVariable].requiredIf.key] ===
						enviromentVariables[eachEnvironmentVariable].requiredIf.value
					) {
						enviromentVariables[eachEnvironmentVariable].optional = false
					}
					break
				case 'NOT_EQUALS':
					if (
						process.env[enviromentVariables[eachEnvironmentVariable].requiredIf.key] !=
						enviromentVariables[eachEnvironmentVariable].requiredIf.value
					) {
						enviromentVariables[eachEnvironmentVariable].optional = false
					}
					break
				default:
					break
			}
		}

		if (enviromentVariables[eachEnvironmentVariable].optional === false) {
			if (!process.env[eachEnvironmentVariable] || process.env[eachEnvironmentVariable] == '') {
				keyCheckPass = false
				if (
					enviromentVariables[eachEnvironmentVariable].default &&
					enviromentVariables[eachEnvironmentVariable].default != ''
				) {
					process.env[eachEnvironmentVariable] = enviromentVariables[eachEnvironmentVariable].default
					keyCheckPass = true
				} else {
					success = false
				}
			} else if (
				enviromentVariables[eachEnvironmentVariable].possibleValues &&
				Array.isArray(enviromentVariables[eachEnvironmentVariable].possibleValues) &&
				enviromentVariables[eachEnvironmentVariable].possibleValues.length > 0
			) {
				if (
					!enviromentVariables[eachEnvironmentVariable].possibleValues.includes(
						process.env[eachEnvironmentVariable]
					)
				) {
					success = false
					keyCheckPass = false
					enviromentVariables[eachEnvironmentVariable].message += ` Valid values - ${enviromentVariables[
						eachEnvironmentVariable
					].possibleValues.join(', ')}`
				}
			}
		}

		if (
			(!process.env[eachEnvironmentVariable] || process.env[eachEnvironmentVariable].trim() === '') &&
			enviromentVariables[eachEnvironmentVariable]?.optional === true &&
			enviromentVariables[eachEnvironmentVariable]?.default !== undefined
		) {
			process.env[eachEnvironmentVariable] = enviromentVariables[eachEnvironmentVariable].default
			keyCheckPass = true
			success = true
		}

		if (!keyCheckPass) {
			if (enviromentVariables[eachEnvironmentVariable].message !== '') {
				tableObj[eachEnvironmentVariable] = enviromentVariables[eachEnvironmentVariable].message
			} else {
				tableObj[eachEnvironmentVariable] = `FAILED - ${eachEnvironmentVariable} is required`
			}
		}
		tableData.push(tableObj)
	})

	log.info(tableData.toString())
	return {
		success: success,
	}
}
