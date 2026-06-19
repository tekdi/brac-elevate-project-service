/**
 * name : solutions.js
 * author : Aman
 * created-date : 19-Jan-2020
 * Description : Solution related information.
 */
// Dependencies
const solutionsHelper = require(MODULES_BASE_PATH + '/solutions/helper')
module.exports = class Solutions extends Abstract {
	constructor() {
		super('solutions')
	}

	static get name() {
		return 'solutions'
	}

	/**
* @api {post} /project/v1/solutions/create Create solution
* @apiVersion 1.0.0
* @apiName Create solution
* @apiGroup Solutions
* @apiParamExample {json} Request-Body:
* {
  "programExternalId" : "AMAN_TEST_123-1607937244986",
  "entityType" : "school",
  "externalId" : "IMPROVEMENT-PROJECT-TEST-SOLUTION",
  "name" : "Improvement project test solution",
  "description" : "Improvement project test solution"
}
* @apiHeader {String} internal-access-token internal access token  
* @apiHeader {String} X-authenticated-user-token Authenticity token
* @apiSampleRequest /project/v1/solutions/create
* @apiUse successBody
* @apiUse errorBody
* @apiParamExample {json} Response:
* {
    "message": "Solution created successfully",
    "status": 200,
    "result": {
        "_id": "6006a94d67f675771573226d"
    }
  }
*/

	/**
 * Create solution.
 * @method
 * @name create
 * @param {Object} req - requested data.
 * req.body : {
    "name": "create solution",
    "programExternalId": "MAHARASTHA-AUTO-TARGETING",
    "resourceType": [],
    "language": [],
    "keywords": [],
    "concepts": [],
    "themes": [],
    "flattenedThemes": [],
    "entities": [
        "5beaa888af0065f0e0a10515",
        "5fd098e2e049735a86b748ac"
    ],
    "registry": [],
    "isRubricDriven": false,
    "enableQuestionReadOut": false,
    "allowMultipleAssessemts": false,
    "isDeleted": false,
    "entityType": "school",
    "type": "improvementProject",
    "subType": "improvementProject",
    "isReusable": false,
    "externalId": "01c04166-a65e-4e92-a87b-a9e4194e771lll",
    "minNoOfSubmissionsRequired": 2,
    "scope": {
        "roles": [
            "head_master","district_education_officer"
        ],
        "state" : ["e3a58f2b3c4d719a6821b590"]
    }
    }
  }

 * @param {String} 
 * @returns {JSON} Created solution data.
 */

	async create(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.createSolution(
					req.body,
					true, //this is true for when its called via API calls
					req.userDetails
				)

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
* @api {post} /project/v1/solutions/update/:solutionId Update solution
* @apiVersion 1.0.0
* @apiName Update solution
* @apiGroup Solutions
* @apiParamExample {json} Request-Body:
* {
  "programExternalId" : "AMAN_TEST_123-1607937244986",
  "entityType" : "school",
  "externalId" : "IMPROVEMENT-PROJECT-TEST-SOLUTION",
  "name" : "Improvement project test solution",
  "description" : "Improvement project test solution"
}
* @apiHeader {String} internal-access-token internal access token  
* @apiHeader {String} X-authenticated-user-token Authenticity token
* @apiSampleRequest /project/v1/solutions/update/6006a94d67f675771573226d
* @apiUse successBody
* @apiUse errorBody
* @apiParamExample {json} Response:
* {
  "message": "Solution updated successfully",
  "status": 200,
  "result": {
      "_id": "6006a94d67f675771573226d"
  }
  }
*/

	/**
   * Update solution.
   * @method
   * @name update
   * @param {Object} req - requested data.
   * @param {String} req.params._id -  solution external id.
   * @apiParamExample {json} Request-Body:
   * {
    "name": "create solution",
    "programExternalId": "MAHARASTHA-AUTO-TARGETING",
    "resourceType": [],
    "language": [],
    "keywords": [],
    "concepts": [],
    "themes": [],
    "flattenedThemes": [],
    "entities": [
        "5beaa888af0065f0e0a10515",
        "5fd098e2e049735a86b748ac"
    ],
    "registry": [],
    "isRubricDriven": false,
    "enableQuestionReadOut": false,
    "allowMultipleAssessemts": false,
    "isDeleted": false,
    "entityType": "school",
    "type": "improvementProject",
    "subType": "improvementProject",
    "isReusable": false,
    "externalId": "01c04166-a65e-4e92-a87b-a9e4194e771lll",
    "minNoOfSubmissionsRequired": 2,
    "scope": {
        "roles": [
            "head_master","district_education_officer"
        ],
        "state" : ["e3a58f2b3c4d719a6821b590"]
    }
}

   * @returns {JSON}
   */

	async update(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.update(
					req.params._id,
					req.body,
					req.userDetails,
					true //this is true for when its called via API calls
				)

				return resolve(solutionData)
			} catch (error) {
				reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/list?page=:page&limit=:limit&search=:search
    * @apiVersion 1.0.0
    * @apiName list solutions
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    {
      "isReusable": false
    }

    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /project/v1/solutions/list?page=1&limit=1&search=&type=improvementProject
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
        "message": "Solutions lists fetched successfully",
        "status": 200,
        "result": {
            "data": [
                {
                    "_id": "5d15b0d7463d3a6961f91748",
                    "externalId": "LSAS-Dream A Dream-2019-TEMPLATE",
                    "name": "Life Skills Assessment Survey",
                    "description": "Life Skills Assessment Survey"
                }
            ],
            "count": 1
        }
      }

    */

	/**
	 * List solutions.
	 * @method
	 * @name list
	 * @param {Object} req - requested data.
	 * @param {String} req.query.type - solution type.
	 * @returns {JSON}
	 */

	async list(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.list(
					req.query.type, //mandatory field to be given
					req.query.subType ? req.query.subType : '',
					req.body,
					req.pageNo,
					req.pageSize,
					req.searchText,
					[],
					req.userDetails,
					req.query.currentOrgOnly ? req.query.currentOrgOnly : false
				)

				return resolve(solutionData)
			} catch (error) {
				reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/addRolesInScope/:solutionId Add roles in solutions
    * @apiVersion 1.0.0
    * @apiName add roles in scope
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    * {
        "roles" : ["head_master"]
      }
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiHeader {String} internal-access-token
    * If you are a System Admin use below headers.
    * @apiHeader {String} admin-auth-token
    * @apiHeader {String} tenantId
    * @apiHeader {String} orgid
    * @apiSampleRequest /project/v1/solutions/addRolesInScope/5ffbf8909259097d48017bbf
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully added roles in solutions scope",
        "status": 200
      }
    */

	/**
	 * Add roles in solution scope
	 * @method
	 * @name addRolesInScope
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id.
	 * @param {Array} req.body.roles - Roles to be added.
	 * @param {Object} req.userDetails - User details
	 * @returns {Array} solution scope roles.
	 */

	// Role-based logic has been removed from the current implementation, so this API is currently not in use.
	//  It may be revisited in the future based on requirements.
	async addRolesInScope(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionUpdated = await solutionsHelper.addRolesInScope(
					req.params._id,
					req.body.roles,
					req.userDetails
				)

				return resolve(solutionUpdated)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/detailsBasedOnRoleAndLocation/:solutionId Solution details based on role and location.
    * @apiVersion 1.0.0
    * @apiName Targeted solution details
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
      {
        "roles": ["head_master","district_education_officer"],
        "state" : ["e3a58f2b3c4d719a6821b590"]
        "filter" : {
            "skipSolutions" : ["660f9383f65100c296372c77"]
        }
      }
    

    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /project/v1/solutions/detailsBasedOnRoleAndLocation/5fc3dff14ea9b44f3340afe2
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    "message": "Successfully targeted solutions fetched",
    "status": 200,
    "result": {
        "_id": "5fc3dff14ea9b44f3340afe2",
        "isAPrivateProgram": true,
        "programId": "5ff438b04698083dbfab7284",
        "programExternalId": "TEST_SCOPE_PROGRAM",
        "programName": "TEST_SCOPE_PROGRAM",
        "programDescription": "TEST_SCOPE_PROGRAM",
        "entityType": "school",
        "entityTypeId": "5d15a959e9185967a6d5e8a6",
        "externalId": "f449823a-06bb-4a3f-9d49-edbe1524ebbb-1606672337956",
        "projectTemplateId": "5ff4a46aa87a5c721f9eb664"
    }
    */

	/**
	 * Solution details based on role and location.
	 * @method
	 * @name detailsBasedOnRoleAndLocation
	 * @param {Object} req - requested data.
	 * @returns {JSON} Created solution data.
	 */

	async detailsBasedOnRoleAndLocation(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionDetails = await solutionsHelper.detailsBasedOnRoleAndLocation(
					req.params._id,
					req.body,
					req.query.type ? req.query.type : ''
				)

				return resolve(solutionDetails)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/removeRolesInScope/:solutionId Remove roles from solutions scope
    * @apiVersion 1.0.0
    * @apiName remove roles in scope
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    * {
    * "roles" : ["head_master"]
    }
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiHeader {String} internal-access-token
    * If you are a System Admin use below headers.
    * @apiHeader {String} admin-auth-token
    * @apiHeader {String} tenantId
    * @apiHeader {String} orgid
    * @apiSampleRequest /project/v1/solutions/removeRolesInScope/5ffbf8909259097d48017bbf
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully removed roles in solution scope",
        "status": 200
      }
    */

	/**
	 * Remove roles in solution scope
	 * @method
	 * @name removeRolesInScope
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id.
	 * @param {Array} req.body.roles - Roles to be added.
	 * @param {Object} req.userDetails - User details
	 * @returns {Array} Removed solution scope roles.
	 */

	// Role-based logic has been removed from the current implementation, so this API is currently not in use.
	//  It may be revisited in the future based on requirements.
	async removeRolesInScope(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionUpdated = await solutionsHelper.removeRolesInScope(
					req.params._id,
					req.body.roles,
					req.userDetails
				)

				return resolve(solutionUpdated)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
  * @api {get} /project/v1/solutions/fetchLink/:solutionId
  * @apiVersion 1.0.0
  * @apiName Get link by solution id
  * @apiGroup Solutions
  * @apiSampleRequest /project/v1/solutions/fetchLink/5fa28620b6bd9b757dc4e932
  * @apiHeader {String} X-authenticated-user-token Authenticity token  
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Response:
  * {
    "message": "Solution Link generated successfully",
    "status": 200,
    "result": "https://dev.sunbirded.org/manage-learn/create-project/38cd93bdb87489c3890fe0ab00e7d406"
    }
  */

	/**
	 * Get link by solution id.
	 * @method
	 * @name fetchLink
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution Id
	 * @returns {Array}
	 */

	async fetchLink(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.fetchLink(
					req.params._id,
					req.userDetails,
					req.userDetails.userToken
				)

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
  * @api {get} /project/v1/solutions/fetchLinkInternal/:solutionId
  * @apiVersion 1.0.0
  * @apiName Get link by solution id
  * @apiGroup Solutions
  * @apiSampleRequest /project/v1/solutions/fetchLinkInternal/5fa28620b6bd9b757dc4e932
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Response:
  * {
    "message": "Solution Link generated successfully",
    "status": 200,
    "result": "https://dev.sunbirded.org/manage-learn/create-project/38cd93bdb87489c3890fe0ab00e7d406"
    }
  */

	/**
	 * Get link by solution id.
	 * @method
	 * @name fetchLinkInternal
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution Id
	 * @returns {Array}
	 */

	async fetchLinkInternal(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.fetchLink(req.params._id)

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
  * @api {post} /project/v1/solutions/verifyLink/:link
  * @apiVersion 1.0.0
  * @apiName verify Link
  * @apiGroup Solutions
  * @apiSampleRequest /project/v1/solutions/verifyLink/6f8d395f674dcb3146ade10f972da9d0
  * @apiHeader {String} X-authenticated-user-token Authenticity token  
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Request:
  * {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
    }
  * @apiParamExample {json} Response:
  * {
      "message": "Solution Link verified successfully",
      "status": 200,
      "result": {
          isATargetedSolution : true/false,
          type: improvementProject,
          solutionId : “5f6853f293734140ccce90cf”,
          projectId : “”,
          obervationId: “”,
          surveyId: “”
      }
    }
  */

	/**
	 * verify Link
	 * @method
	 * @name verifyLink
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution link
	 * @returns {Array}
	 */

	async verifyLink(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.verifyLink(
					req.params._id,
					req.body,
					req.userDetails.userInformation.userId,
					req.userDetails.userToken,
					req.query.hasOwnProperty('createProject')
						? UTILS.convertStringToBoolean(req.query.createProject)
						: true,
					req.userDetails
				)
				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/addEntitiesInScope/:solutionId Add entities in solutions
    * @apiVersion 1.0.0
    * @apiName Add entities in solutions
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    * 
      {
        "entities": {
            "district": [
                "67c82d9553812588916410d3"
            ],
            "professional_subroles": [
                "682301604e2812081f342674",
                "682303044e2812081f3426fb"
            ],
            "professional_role": [
                "681b07b49c57cdcf03c79ae3",
                "681b0800f21c88cef9517e0e"
            ],
            "school": [
                "67c82d9553812588916410d3"
            ],
            "language": [
                "681b0800f21c88cef951890e"
            ],
            "gender": [
                "67c82d955381258891642345"
            ]
        },
        "organizations": [
            "blr"
        ]
      } 
    }
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiHeader {String} internal-access-token
    * If you are a System Admin use below headers.
    * @apiHeader {String} admin-auth-token
    * @apiHeader {String} tenantId
    * @apiHeader {String} orgid
    * @apiSampleRequest /project/v1/solutions/addEntitiesInScope/5ffbf8909259097d48017bbf
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully added entities in solution scope",
        "status": 200
      }
    */

	/**
	 * Add entities in solution scope
	 * @method
	 * @name addEntitiesInScope
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id.
	 * @param {Object} req.body - data to be added.
	 * @param {Object} req.userDetails - User details
	 * @returns {Array} Solution scope entities updation.
	 */

	async addEntitiesInScope(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionUpdated = await solutionsHelper.addEntitiesInScope(
					req.params._id,
					req.body,
					req.userDetails
				)

				return resolve(solutionUpdated)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/removeEntitiesInScope/:solutionId Remove entities from solution scope.
    * @apiVersion 1.0.0
    * @apiName Remove entities from solution scope.
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    * {
        "entities": {
            "professional_subroles": [
                "682301254e2812081f34266c",
                "682303044e2812081f3426fb",
                "682301604e2812081f342674"
            ],
            "professional_role": [
                "681b07b49c57cdcf03c79ae3",
                "681b0800f21c88cef9517e0e"
            ]
        },
        "organizations": [
            "ALL"
        ]
    }
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiHeader {String} internal-access-token
    * If you are a System Admin use below headers.
    * @apiHeader {String} admin-auth-token
    * @apiHeader {String} tenantId
    * @apiHeader {String} orgid
    * @apiSampleRequest /project/v1/solutions/removeEntitiesInScope/5ffbf8909259097d48017bbf
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully removed entities in solution scope",
        "status": 200
      }
    */

	/**
	 * Remove entities in slution scope
	 * @method
	 * @name removeEntitiesInScope
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id.
	 * @param {Object} req.body - data to be removed.
	 * @param {Object} req.userDetails - User details
	 * @returns {Array} Program scope roles.
	 */

	async removeEntitiesInScope(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionUpdated = await solutionsHelper.removeEntitiesInScope(
					req.params._id,
					req.body,
					req.userDetails
				)

				return resolve(solutionUpdated)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
  * @api {post} /project/v1/solutions/verifySolution/:Id
  * @apiVersion 1.0.0
  * @apiName verify Solutions targeted
  * @apiGroup Solutions
  * @apiSampleRequest /project/v1/solutions/verifySolution/5f6853f293734140ccce90cf
  * @apiHeader {String} X-authenticated-user-token Authenticity token  
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Request:
  * {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
    }
  * @apiParamExample {json} Response:
  * {
      "message": "Solution verified successfully",
      "status": 200,
      "result": {
          isATargetedSolution : true/false,
          _id : “5f6853f293734140ccce90cf”,
      }
    }
  */

	/**
	 * verify Solution
	 * @method
	 * @name verifySolution
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id
	 * @returns {Array}
	 */

	async verifySolution(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.isTargetedBasedOnUserProfile(req.params._id, req.body)

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/forUserRoleAndLocation?programId=:programId&type=:type&subType=:subType&page=:page&limit=:limit Auto targeted solutions
    * @apiVersion 1.0.0
    * @apiName Auto targeted solution
    * @apiGroup Solutions
    * @apiParamExample {json} Request-Body:
    * {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
      }
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /project/v1/solutions/forUserRoleAndLocation?type=assessment&page=1&limit=5
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    "message": "Successfully targeted solutions fetched",
    "status": 200,
    "result": {
        "data": [
            {
                "_id": "5ff447e127ef425953bd8306",
                "programId": "5ff438b04698083dbfab7284",
                "programName": "TEST scope in program"
            }
        ],
        "count": 1
    }
    }
    */

	/**
	 * Auto targeted solution.
	 * @method
	 * @name forUserRoleAndLocation
	 * @param {Object} req - requested data.
	 * @returns {JSON} Created solution data.
	 */

	async forUserRoleAndLocation(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let targetedSolutions = await solutionsHelper.forUserRoleAndLocation(
					req.body,
					req.query.type ? req.query.type : '',
					req.query.subType ? req.query.subType : '',
					req.query.programId ? req.query.programId : '',
					req.pageSize,
					req.pageNo,
					req.searchText,
					req.userDetails
				)

				return resolve(targetedSolutions)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/solutions/targetedSolutions?type=:solutionType&page=:page&limit=:limit&search=:search&filter=:filter&currentScopeOnly=:&entityId=:
    * List of assigned solutions and targetted ones.
    * @apiVersion 1.0.0
    * @apiGroup Solutions
    * @apiSampleRequest /project/v1/solutions/targetedSolutions?type=observation&page=1&limit=10&search=a&filter=assignedToMe&currentScopeOnly=true&entityId=English
    * @apiParamExample {json} Request:
    * {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
        "factors" : ["role","entities"] // optional if passed query will be generated based on passed keys (dynamic scoping)
    }
    * @apiParamExample {json} Response:
    {
    "message": "Solutions fetched successfully",
    "status": 200,
    "result": {
        "data": [
            {
                "_id": "6708b3fcdf2bce38acf4119f",
                "solutionId": "66bf077ae74aa1727af8b1d4",
                "creator": "",
                "solutionMetaInformation": {},
                "type": "improvementProject",
                "externalId": "sol-1-IM-5",
                "projectTemplateId": "66bf07a1e74aa1727af8b1dc",
                "certificateTemplateId": "66bf0822e74aa1727af8b1e7",
                "programId": "66bb85bebf682a1f367c55b9",
                "programName": "Certificate test VVP4",
                "name": "Certificate_Testing_VVP5",
                "certificate": {
                    "templateUrl": "certificate/c4320cd4-7f63-4d48-b065-0d8f6f732153/162/cb234a78-f252-49f5-8cac-2b7f0dc7e631/66bf0822e74aa1727af8b1e7/16-7-2024-1723795534888_dev_s2l2",
                    "status": "active",
                    "criteria": {
                        "validationText": "Complete validation message",
                        "expression": "C1&&C2",
                        "conditions": {
                            "C1": {
                                "validationText": "Project Should be submitted.",
                                "expression": "C1",
                                "conditions": {
                                    "C1": {
                                        "scope": "project",
                                        "key": "status",
                                        "operator": "==",
                                        "value": "submitted"
                                    }
                                }
                            },
                            "C2": {
                                "validationText": "Evidence project level validation",
                                "expression": "C1",
                                "conditions": {
                                    "C1": {
                                        "scope": "project",
                                        "key": "attachments",
                                        "function": "count",
                                        "filter": {
                                            "key": "type",
                                            "value": "all"
                                        },
                                        "operator": ">=",
                                        "value": 1
                                    }
                                }
                            }
                        }
                    },
                    "templateId": "66bf0822e74aa1727af8b1e7"
                },
                "status": "started",
                "hasAcceptedTAndC": false,
                "description": "Encourage school leaders to learn about various digital initiatives and share ideas that would be implemented in their schools.",
                "lastDownloadedAt": "2024-10-11T05:13:32.795Z"
            },
             {
                "_id": "",
                "solutionId": "66d83cf920413cc3c03ed131",
                "creator": "Priyanka",
                "solutionMetaInformation": {},
                "type": "improvementProject",
                "externalId": "IDE-1725447416207-PROJECT-SOLUTION",
                "projectTemplateId": "66d83cf95675a3c3b6fced6d",
                "programId": "66d834343a240f0b7407bb53",
                "programName": "Test elevate_shiksha",
                "name": "OneThree",
                "description": "Send an invitation to parents with the PTM date and time, and prepare the agenda with teachers. During the meeting, welcome parents, conduct an ice breaker, discuss the 'Parents as Partners' initiative, and have one-on-one conversations. Collect feedback and encourage sharing photos of learning spaces. After the meeting, record attendance, review feedback, and upload data to the app."
            }
        ],
        "count": 2
    }}
    * @apiUse successBody
    * @apiUse errorBody
    */

	/**
	 * List of solutions and targetted ones.
	 * @method
	 * @name targetedSolutions
	 * @param {Object} req.body - request data.
	 * @param {String} req.query.type - solution type
	 * @param {String} req.userDetails.userInformation.userId - user id
	 * @param {Number} req.pageSize - page size limit
	 * @param {Number} req.pageNo - page number
	 * @param {String} req.searchText - search text
	 * @param {String} req.filter - filter data
	 * @param {Boolean} req.query.currentScopeOnly - boolean value to fetch only current scope documents/projects
	 * @param {String} req.query.entityId - helps to fetch documents/projects based on entity id
	 * @returns {JSON} List of solutions with targetted ones.
	 */

	async targetedSolutions(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let observations = await solutionsHelper.targetedSolutions(
					req.body,
					req.query.type,
					req.userDetails.userInformation.userId,
					req.pageSize,
					req.pageNo,
					req.searchText,
					req.query.filter,
					req.query.surveyReportPage ? req.query.surveyReportPage : '',
					req.query.currentScopeOnly ? req.query.currentScopeOnly : false,
					req.userDetails
				)

				return resolve(observations)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
  * @api {post} /project/v1/solutions/verifySolution/:Id
  * @apiVersion 1.0.0
  * @apiName verify Solutions targeted
  * @apiGroup Solutions
  * @apiSampleRequest /project/v1/solutions/verifySolution/5f6853f293734140ccce90cf
  * @apiHeader {String} X-authenticated-user-token Authenticity token  
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Request:
  * {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
    }
  * @apiParamExample {json} Response:
  * {
      "message": "Solution Link verified successfully",
      "status": 200,
      "result": {
          isATargetedSolution : true/false,
          _id : “5f6853f293734140ccce90cf”,
      }
    }
  */

	/**
	 * isTargetedBasedOnUserProfile
	 * @method
	 * @name isTargetedBasedOnUserProfile
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id
	 * @returns {Array}
	 */

	async isTargetedBasedOnUserProfile(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.isTargetedBasedOnUserProfile(req.params._id, req.body)

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
    * @api {get} /project/v1/solutions/getDetails/:solutionId Solution details
    * @apiVersion 1.0.0
    * @apiName Details of the solution.
    * @apiGroup Solutions
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /project/v1/solutions/getDetails/5ffbf8909259097d48017bbf
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    "message": "Solution details fetched successfully",
    "status": 200,
    "result": {
        "_id": "601bc17489149727d7d70bbd",
        "resourceType": [
            "Observations Framework"
        ],
        "language": [
            "English"
        ],
        "keywords": [
            "Framework",
            "Observation",
            "Challenges",
            " Enrollment",
            " Parents",
            " Courses "
        ],
        "concepts": [],
        "themes": [
            {
                "type": "theme",
                "label": "theme",
                "name": "Observation Theme",
                "externalId": "OB",
                "weightage": 100,
                "criteria": [
                    {
                        "criteriaId": "601bc17489149727d7d70bbb",
                        "weightage": 50
                    },
                    {
                        "criteriaId": "601bc17489149727d7d70bbc",
                        "weightage": 50
                    }
                ]
            }
        ],
        "flattenedThemes": [],
        "entities": [],
        "registry": [],
        "isRubricDriven": false,
        "enableQuestionReadOut": false,
        "captureGpsLocationAtQuestionLevel": false,
        "isAPrivateProgram": false,
        "allowMultipleAssessemts": false,
        "isDeleted": false,
        "deleted": false,
        "externalId": "99199aec-66b8-11eb-b81d-a08cfd79f8b7-OBSERVATION-TEMPLATE",
        "name": "Enrollment challenges in DIKSHA Courses",
        "description": "Survey Form to understand the challenges that the parents are facing in getting their children enrolled in DIKSHA courses ",
        "author": "",
        "levelToScoreMapping": {
            "L1": {
                "points": 100,
                "label": "Good"
            }
        },
        "scoringSystem": null,
        "noOfRatingLevels": 1,
        "entityTypeId": "5f32d8228e0dc83124040567",
        "entityType": "school",
        "updatedBy": "INITIALIZE",
        "createdAt": "2021-02-04T07:14:19.353Z",
        "updatedAt": "2021-02-04T09:42:12.853Z",
        "__v": 0,
        "type": "observation",
        "subType": "school",
        "frameworkId": "601bbed689149727d7d70bba",
        "frameworkExternalId": "99199aec-66b8-11eb-b81d-a08cfd79f8b7",
        "isReusable": true,
        "evidenceMethods": {
            "OB": {
                "externalId": "OB",
                "tip": "",
                "name": "Observation",
                "description": "",
                "modeOfCollection": "onfield",
                "canBeNotApplicable": 0,
                "notApplicable": 0,
                "canBeNotAllowed": 0,
                "remarks": ""
            }
        },
        "sections": {
            "S1": "Start Survey"
        }
    }}
    */

	/**
	 * Details of the solution.
	 * @method
	 * @name getDetails
	 * @param {Object} req - requested data.
	 * @param {String} req.params._id - solution id.
	 * @returns {Object} Solution details
	 */

	async getDetails(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.getDetails(req.params._id, req.userDetails)

				solutionData['result'] = solutionData.data

				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}

	/**
     * @api {post} /project/v1/solutions/details/:solutionId
     * @apiVersion 1.0.0
     * @apiName Get Project Template or Solution Questions
     * @apiGroup Solutions
     * @apiSampleRequest /project/v1/solutions/details/5ff9d50f9259097d48017bbb
     * @apiHeader {String} X-authenticated-user-token Authenticity token  
     * @apiUse successBody
     * @apiUse errorBody
     * @apiParamExample {json} Request:
        {
        "roles": "head_master,district_education_officer",
        "state" : ["e3a58f2b3c4d719a6821b590"]
        }
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully fetched details",
        "status": 200,
        "result": {
            "_id": "5f97d2f6bf3a3b1c0116c80a",
            "status": "published",
            "isDeleted": false,
            "categories": [
                {
                    "_id": "5f102331665bee6a740714e8",
                    "name": "Teachers",
                    "externalId": "teachers"
                },
                {
                    "name": "newCategory",
                    "externalId": "",
                    "_id": ""
                }
            ],
            "tasks": [
                {
                    "_id": "289d9558-b98f-41cf-81d3-92486f114a49",
                    "name": "Task 1",
                    "description": "Task 1 description",
                    "status": "notStarted",
                    "isCustomTask": false,
                    "startDate": "2020-09-29T09:08:41.667Z",
                    "endDate": "2020-09-29T09:08:41.667Z",
                    "lastModifiedAt": "2020-09-29T09:08:41.667Z",
                    "type": "single",
                    "isDeleted": false,
                    "attachments": [
                        {
                            "name": "download(2).jpeg",
                            "type": "image/jpeg",
                            "sourcePath": "projectId/userId/imageName"
                        }
                    ],
                    "remarks": "Tasks completed",
                    "assignee": "Aman",
                    "children": [
                        {
                            "_id": "289d9558-b98f-41cf-81d3-92486f114a50",
                            "name": "Task 2",
                            "description": "Task 2 description",
                            "status": "notStarted",
                            "children": [],
                            "isCustomTask": false,
                            "startDate": "2020-09-29T09:08:41.667Z",
                            "endDate": "2020-09-29T09:08:41.667Z",
                            "lastModifiedAt": "2020-09-29T09:08:41.667Z",
                            "type": "single",
                            "isDeleted": false,
                            "externalId": "task 2",
                            "isDeleteable": false,
                            "createdAt": "2020-10-28T05:58:24.907Z",
                            "updatedAt": "2020-10-28T05:58:24.907Z",
                            "isImportedFromLibrary": false
                        }
                    ],
                    "externalId": "task 1",
                    "isDeleteable": false,
                    "createdAt": "2020-10-28T05:58:24.907Z",
                    "updatedAt": "2020-10-28T05:58:24.907Z",
                    "isImportedFromLibrary": false
                }
            ],
            "resources": [],
            "deleted": false,
            "__v": 0,
            "description": "Project 1 description"
        }
    } */

	/**
	 * get solution details
	 * @method
	 * @name details
	 * @param {String} req.params._id - solution Id
	 * @param {Object} req.body - requested data.
	 * @param {String} req.userDetails.userInformation.userId - User Id.
	 * @returns {Object} result.
	 */

	async details(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let solutionData = await solutionsHelper.details(req.params._id, req.body, req.userDetails)
				return resolve(solutionData)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
					errorObject: error,
				})
			}
		})
	}
}
