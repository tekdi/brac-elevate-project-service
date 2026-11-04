/**
 * name : templates.js
 * author : Aman
 * created-date : 22-July-2020
 * Description : Projects templates related information.
 */

// Dependencies

const csv = require('csvtojson')
const projectTemplatesHelper = require(MODULES_BASE_PATH + '/project/templates/helper')

/**
 * ProjectTemplates
 * @class
 */

module.exports = class ProjectTemplates extends Abstract {
	/**
	 * @apiDefine errorBody
	 * @apiError {String} status 4XX,5XX
	 * @apiError {String} message Error
	 */

	/**
	 * @apiDefine successBody
	 * @apiSuccess {String} status 200
	 * @apiSuccess {String} result Data
	 */

	constructor() {
		super('project-templates')
	}

	/**
	 * @api {post} /project/v1/project/templates/bulkCreate
	 * Bulk Create projects templates.
	 * @apiVersion 1.0.0
	 * @apiGroup Project Templates
	 * @apiParam {File} projectTemplates Mandatory project templates file of type CSV.
	 * @apiSampleRequest /project/v1/project/templates/bulkCreate
	 * @apiUse successBody
	 * @apiUse errorBody
	 */

	/**
	 * Bulk Create project templates
	 * @method
	 * @name bulkCreate
	 * @returns {JSON} returns uploaded project templates.
	 */

	async bulkCreate(req) {
		return new Promise(async (resolve, reject) => {
			try {
				if (!req.files || !req.files.projectTemplates) {
					return resolve({
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATES_CSV,
					})
				}
				const templatesData = await csv().fromString(req.files.projectTemplates.data.toString())

				const projectTemplates = await projectTemplatesHelper.bulkCreate(
					templatesData,
					req.userDetails,
					req.files.translationFiles
				)

				return resolve(projectTemplates)
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
	 * @api {post} /project/v1/project/templates/bulkUpdate
	 * Bulk Update projects templates.
	 * @apiVersion 1.0.0
	 * @apiGroup Project Templates
	 * @apiParam {File} projectTemplates Mandatory project templates file of type CSV.
	 * @apiSampleRequest /project/v1/project/templates/bulkUpdate
	 * @apiUse successBody
	 * @apiUse errorBody
	 */

	/**
	 * Bulk Update project templates
	 * @method
	 * @name bulkUpdate
	 * @returns {JSON} returns uploaded project templates.
	 */

	async bulkUpdate(req) {
		return new Promise(async (resolve, reject) => {
			try {
				if (!req.files || !req.files.projectTemplates) {
					return resolve({
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.PROJECT_TEMPLATES_CSV,
					})
				}

				const templatesData = await csv().fromString(req.files.projectTemplates.data.toString())

				const projectTemplates = await projectTemplatesHelper.bulkUpdate(
					templatesData,
					req.userDetails.userInformation.userId
				)

				return resolve(projectTemplates)
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
    * @api {post} /project/v1/project/templates/importProjectTemplate/:projectTemplateExternalId
    * Import templates from existsing project templates.
    * @apiVersion 1.0.0
    * @apiGroup Project Templates
    * @apiSampleRequest /project/v1/project/templates/importProjectTemplate/template-1
    * @apiParamExample {json} Request:
    * {
    * "externalId" : "template1",
      "isReusable" : false,
      "rating" : 5
    * }
    * @apiParamExample {json} Response:
    * {
        "message": "Successfully created duplicate project templates",
        "status": 200,
        "result": {
            "_id": "5f2402f570d11462f8e9a591"
        }
    }
    * @apiUse successBody
    * @apiUse errorBody
    */

	/**
	 * Import templates from existsing project templates.
	 * @method
	 * @name importProjectTemplate
	 * @param {Object} req - request data.
	 * @param {String} req.params._id - project Template ExternalId.
	 * @returns {JSON} returns imported project templates.
	 */

	async importProjectTemplate(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let projectTemplates = await projectTemplatesHelper.importProjectTemplate(
					req.params._id,
					req.userDetails.userInformation.userId,
					req.userDetails.userToken,
					req.query.solutionId ? req.query.solutionId : '',
					req.body,
					req.userDetails
				)

				projectTemplates.result = projectTemplates.data

				return resolve(projectTemplates)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/project/templates/listByIds
    * List templates based on ids.
    * @apiVersion 1.0.0
    * @apiGroup Project Templates
    * @apiSampleRequest /project/v1/project/templates/listByIds
    * @apiParamExample {json} Request:
    * {
    * "externalIds" : ["IDEAIMP 4"]
    * }
    * @apiParamExample {json} Response:
    * {
    "message": "List of project templates fetched successfully",
    "status": 200,
    "result": [
        {
            "_id": "5fd0c55d496c5a49b203e047",
            "title": "Keep Our Schools Alive! (Petition)",
            "externalId": "IDEAIMP 4",
            "goal": "Leveraging the huge number of private schools to show the significance of the financial problem by creating a petition and presenting to the authorities."
        }
    ]
    }
    * @apiUse successBody
    * @apiUse errorBody
    */

	/**
	 * List templates based on ids.
	 * @method
	 * @name listByIds
	 * @param {Object} req - request data.
	 * @returns {Array} List of templates.
	 */

	async listByIds(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let projectTemplates = await projectTemplatesHelper.listByIds(req.body.externalIds, req.userDetails)

				projectTemplates.result = projectTemplates.data

				return resolve(projectTemplates)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}

	/**
    * @api {get} /project/v1/project/templates/details/:templateId
    * Project template details.
    * @apiVersion 1.0.0
    * @apiGroup Project Templates
    * @apiSampleRequest /project/v1/project/templates/details/MAHARASTHA IMPROVEMENT PROJECT TEMPLATE
    * @apiParamExample {json} Response:
    * {
    "message": "Successfully fetched project template details",
    "status": 200,
    "result": {
        "_id": "5ffbd53f5fc92a7dbc972906",
        "description": "",
        "concepts": [
            ""
        ],
        "keywords": [
            "Community, Parent Mela"
        ],
        "isDeleted": false,
        "recommendedFor": [],
        "tasks": [
            {
                "_id": "5fd2447b1233354b094f15d5",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15db",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d5",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "Look for videos and case studies which capture the parent mela or parent meeting conducted in different schools. Focus on the ideas being used and themes being selected.",
                        "externalId": "IMP-3147aa-TASK7",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.478Z",
                        "createdAt": "2020-12-10T15:53:31.476Z",
                        "parentId": "5fd2447b1233354b094f15d5",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Look for samples of parent mela/ excitement building parent meeting from different schools",
                "externalId": "IMP-3147aa-TASK1",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.477Z",
                "createdAt": "2020-12-10T15:53:31.460Z",
                "isDeletable": true
            },
            {
                "_id": "5fd2447b1233354b094f15d6",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15dc",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d6",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "-Meeting with teachers to discuss the importance and role of parent mela in improving community engagement in the school.",
                        "externalId": "IMP-3147aa-TASK8",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.483Z",
                        "createdAt": "2020-12-10T15:53:31.481Z",
                        "parentId": "5fd2447b1233354b094f15d6",
                        "isDeletable": true
                    },
                    {
                        "_id": "5fd2447b1233354b094f15e1",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d6",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "-Discuss stories from other schools.",
                        "externalId": "IMP-3147aa-TASK13",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.511Z",
                        "createdAt": "2020-12-10T15:53:31.509Z",
                        "parentId": "5fd2447b1233354b094f15d6",
                        "isDeletable": true
                    },
                    {
                        "_id": "5fd2447b1233354b094f15e2",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d6",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "- Form a committee among teachers to plan and facilitate the mela along with the school leader.",
                        "externalId": "IMP-3147aa-TASK14",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.524Z",
                        "createdAt": "2020-12-10T15:53:31.521Z",
                        "parentId": "5fd2447b1233354b094f15d6",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Form a parent mela committee among the teachers",
                "externalId": "IMP-3147aa-TASK2",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.522Z",
                "createdAt": "2020-12-10T15:53:31.463Z",
                "isDeletable": true
            },
            {
                "_id": "5fd2447b1233354b094f15d7",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15dd",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d7",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "Finalize the themes and activities for the mela. This could be taken borrowed from other schools or decided by the teachers through brainstorming. \nFinalize the dates for the same",
                        "externalId": "IMP-3147aa-TASK9",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.489Z",
                        "createdAt": "2020-12-10T15:53:31.487Z",
                        "parentId": "5fd2447b1233354b094f15d7",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Planning for the mela",
                "externalId": "IMP-3147aa-TASK3",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.488Z",
                "createdAt": "2020-12-10T15:53:31.465Z",
                "isDeletable": true
            },
            {
                "_id": "5fd2447b1233354b094f15d8",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15de",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d8",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "Communicate the event with parents and invite them to the mela",
                        "externalId": "IMP-3147aa-TASK10",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.496Z",
                        "createdAt": "2020-12-10T15:53:31.493Z",
                        "parentId": "5fd2447b1233354b094f15d8",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Invite parents",
                "externalId": "IMP-3147aa-TASK4",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.494Z",
                "createdAt": "2020-12-10T15:53:31.468Z",
                "isDeletable": true
            },
            {
                "_id": "5fd2447b1233354b094f15d9",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15df",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15d9",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "Do necessary arrangements for smooth functioning of the event and to make it attractive and interesting to parents",
                        "externalId": "IMP-3147aa-TASK11",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.501Z",
                        "createdAt": "2020-12-10T15:53:31.498Z",
                        "parentId": "5fd2447b1233354b094f15d9",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Make the arrangements",
                "externalId": "IMP-3147aa-TASK5",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.499Z",
                "createdAt": "2020-12-10T15:53:31.471Z",
                "isDeletable": true
            },
            {
                "_id": "5fd2447b1233354b094f15da",
                "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                "isDeleted": false,
                "taskSequence": [],
                "children": [
                    {
                        "_id": "5fd2447b1233354b094f15e0",
                        "createdBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "updatedBy": "140558b9-7df4-4993-be3c-31eb8b9ca368",
                        "isDeleted": false,
                        "taskSequence": [],
                        "children": [],
                        "visibleIf": [
                            {
                                "operator": "===",
                                "_id": "5fd2447b1233354b094f15da",
                                "value": "started"
                            }
                        ],
                        "hasSubTasks": false,
                        "learningResources": [],
                        "deleted": false,
                        "type": "simple",
                        "name": "Make sure you collect feedback from parents after the event and reflect among the teachers to see the areas of improvement for next year.",
                        "externalId": "IMP-3147aa-TASK12",
                        "description": "",
                        "updatedAt": "2020-12-10T15:53:31.506Z",
                        "createdAt": "2020-12-10T15:53:31.503Z",
                        "parentId": "5fd2447b1233354b094f15da",
                        "isDeletable": true
                    }
                ],
                "visibleIf": [],
                "hasSubTasks": true,
                "learningResources": [],
                "deleted": false,
                "type": "simple",
                "name": "Collect feedback after the event",
                "externalId": "IMP-3147aa-TASK6",
                "description": "",
                "updatedAt": "2020-12-10T15:53:31.505Z",
                "createdAt": "2020-12-10T15:53:31.473Z",
                "isDeletable": true
            }
        ],
        "learningResources": [
            {
                "name": "Examprep_10EM_ps_cha1_Q3",
                "id": "do_31268582767737241615189",
                "app": "diksha",
                "link": "https://staging.sunbirded.org/resources/play/content/do_31268582767737241615189"
            },
            {
                "name": "Examprep_10tm_ps_cha 11-Q2",
                "id": "do_31269107959395942417491",
                "app": "diksha",
                "link": "https://staging.sunbirded.org/resources/play/content/do_31269107959395942417491"
            },
            {
                "name": "Examprep_10tm_ps_cha 11-Q3",
                "id": "do_31269108472948326417493",
                "app": "diksha",
                "link": "https://staging.sunbirded.org/resources/play/content/do_31269108472948326417493"
            }
        ],
        "isReusable": false,
        "taskSequence": [],
        "deleted": false,
        "categories": [
            {
                "_id": "5fcfa9a2457d6055e33843f2",
                "externalId": "community",
                "name": "Community"
            }
        ],
        "title": "Come See Our School!- Parent Mela",
        "externalId": "MAHARASTHA IMPROVEMENT PROJECT TEMPLATE",
        "entityType": "",
        "taskCreationForm": "",
        "status": "published",
        "solutionId": "5ff9dc1b9259097d48017bbe",
        "solutionExternalId": "MAHARASTHA-IMPROVEMENT-PROJECT",
        "programInformation": {
            "programId": "5ff840ce383ae437eb02b96c",
            "programName": "MAHARASTHA AUTO TARGETING program"
        },
        "rationale": "",
        "primaryAudience": [
            "Community"
        ],
        "goal": "Organizing the Parent Mela in the school in order to make better community reach",
        "duration": "At the end of every quarter",
        "successIndicators": "",
        "risks": "",
        "approaches": "",
        "projectId": ""
    }}
    * @apiUse successBody
    * @apiUse errorBody
    */

	/**
	 * Project templates details.
	 * @method
	 * @name details
	 * @param {Object} req - request data.
	 * @returns {Array} Details templates.
	 */

	async details(req) {
		return new Promise(async (resolve, reject) => {
			try {
				if (!req.params._id && !req.query.link) {
					throw {
						status: HTTP_STATUS_CODE.bad_request.status,
						message: CONSTANTS.apiResponses.TEMPLATE_ID_OR_LINK_REQUIRED,
					}
				}

				let projectTemplatesDetails = await projectTemplatesHelper.details(
					req.params._id ? req.params._id : '',
					req.query.link ? req.query.link : '',
					req.userDetails && req.userDetails.userInformation && req.userDetails.userInformation.userId
						? req.userDetails.userInformation.userId
						: '',
					req.query.isAPrivateProgram ? req.query.isAPrivateProgram : '',
					req.query.language ? req.query.language : '',
					req.userDetails
				)

				return resolve(projectTemplatesDetails)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}

	/**
    * @api {post} /project/v1/project/templates/update/:templateId
    * Update projects template.
    * @apiVersion 1.0.0
    * @apiGroup Project Templates
    * @apiSampleRequest /project/v1/project/templates/update/6006b5cca1a95727dbcdf648
    * @apiHeader {String} internal-access-token internal access token
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    *  "status": 200,
        "message": "template updated successfully"
    }
    */

	/**
	 * Update project templates
	 * @method
	 * @name update
	 * @returns {JSON} returns uploaded project template.
	 */

	async update(req) {
		return new Promise(async (resolve, reject) => {
			try {
				let projectTemplate = await projectTemplatesHelper.update(
					req.params._id,
					req.body,
					req.userDetails.userInformation.userId
				)

				projectTemplate.result = projectTemplate.data

				return resolve(projectTemplate)
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
    * @description          - List project Templates.
    * @method
    * @name                 - list
    * @param {Object} req   - request data.
    * @returns {Array}      - List of projecttemplates.
    * @apiParamExample {json} Response:
    * {
            "message": "List of project templates fetched successfully",
            "status": 200,
            "result": [
                {
                    "_id": "64b529375bfa678a0f257936",
                    "description": "test",
                    "concepts": [
                        ""
                    ],
                    "keywords": [
                        "DIET PUSA, SAMASTIPUR, मापन- लम्बाई, भार, धारिता ."
                    ],
                    "isDeleted": false,
                    "recommendedFor": [],
                    "tasks": [
                        "64b52b371ea4158a83031417",
                        "64b52b371ea4158a8303141a",
                        "64b52b371ea4158a8303141d",
                        "64b52b371ea4158a83031420",
                        "64b52b371ea4158a83031423",
                        "64b52b371ea4158a83031426"
                    ],
                    "createdBy": "64b12ef31073b0dd429e19b4",
                    "updatedBy": "64b12ef31073b0dd429e19b4",
                    "learningResources": [],
                    "isReusable": true,
                    "taskSequence": [
                        "MIPMLC23-Task1-1688974067915",
                        "MIPMLC23-Task2-1688974067915",
                        "MIPMLC23-Task3-1688974067915",
                        "MIPMLC23-Task4-1688974067915",
                        "MIPMLC23-Task5-1688974067915",
                        "MIPMLC23-Task6-1688974067915"
                    ],
                    "averageRating": 0,
                    "noOfRatings": 0,
                    "ratings": {
                        "1": 0,
                        "2": 0,
                        "3": 0,
                        "4": 0,
                        "5": 0
                    },
                    "deleted": false,
                    "title": "ha",
                    "externalId": "cool",
                    "categories": [
                        {
                            "_id": "64b528c45bfa678a0f257931",
                            "externalId": "educationLeader",
                            "name": "Education Leader"
                        },
                        {
                            "_id": "64b5281a5bfa678a0f25792f",
                            "externalId": "teachers",
                            "name": "Teachers"
                        }
                    ],
                    "entityType": "",
                    "taskCreationForm": "",
                    "metaInformation": {
                        "_SYSTEM_ID": "64b0069953f17359a954ed51",
                        "goal": "",
                        "rationale": "",
                        "primaryAudience": "",
                        "duration": "2 Weeks",
                        "successIndicators": "",
                        "risks": "",
                        "approaches": ""
                    },
                    "status": "published",
                    "updatedAt": "2023-07-17T11:42:47.533Z",
                    "createdAt": "2023-07-17T11:42:47.533Z",
                    "__v": 0
                }
            ]
        }
    */

	async list(req) {
		return new Promise(async (resolve, reject) => {
			try {
				// Call the 'list' method from the 'projectTemplatesHelper' object,
				// passing in the required parameters.
				let projectTemplates = await projectTemplatesHelper.list(
					req.pageNo,
					req.pageSize,
					req.searchText,
					req.query.currentOrgOnly ? req.query.currentOrgOnly : false,
					req.userDetails,
					req.query.categoryIds ? req.query.categoryIds : '',
					req.query.groupByCategory ? req.query.groupByCategory : false,
					req.query.taskDetails ? req.query.taskDetails : false
				)

				// Assign the 'data' property of 'projectTemplates' to 'result'.
				projectTemplates.result = projectTemplates.data

				// Resolve the promise with the modified 'projectTemplates'.
				return resolve(projectTemplates)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}

	/**
	 * @function createChildProjectTemplate
     * @api {post} /project/v1/project/templates/createChildProjectTemplate?isExternalProgram=true&programExternalId=AWS_Prog_MYS_may192
	 * @description Handles the creation of child project templates by delegating to the helper function.
	 *              Extracts necessary data from the request object and returns the service response.
	 * This API:
     * 1. Fetches each project template scoped to the authenticated user's tenant org.
     * 2. Creates a new Solution entry for each fetched project template, associated with the provided `programExternalId`.
     * 3. Imports and duplicates the fetched Project Template into the newly created solution.
     * 4. Returns the mapping of parent template externalIds to the newly created (child) template IDs.
     *
	 * @param {Object} req - Express request object.
	 * @param {Array<string>} req.body.projectTemplateExternalIds - Array of project template external IDs to duplicate.
	 * @param {Object} req.userDetails - Information about the authenticated user.
	 * @param {Object} req.query - Query parameters.
	 * @param {string} [req.query.programExternalId] - External ID of the program (optional).
	 * @param {boolean} [req.query.isExternalProgram=true] - Flag to mark if the program is external.
	 *
	 * @returns {Promise<Object>} Resolves with the response from `projectTemplatesHelper.createChildProjectTemplate`.
	 *                            If successful, includes both `data` and `result` for consistency.
	 *                            Rejects with structured error details on failure.
	 *
	 * @apiParamExample {json} Response:
     * {
        "projectTemplateExternalIds": [
                "IDE-1747297137661",
                "IDE-1747297530253",
                "IDE-1747326100274"
            ]
    }
    *@apiParamExample {json} Response:
	 * {
    "message": "Successfully created duplicate project templates",
    "status": 200,
    "result": {
        "successfulTemplates": [
            {
                "parentExternalId": "IDE-1747297137661",
                "_id": "68ebe09ff17e2f28c3b8c818",
                "externalId": "IDE-1747297137661-1760288927495",
                "isReusable": false
            },
            {
                "parentExternalId": "IDE-1747297530253",
                "_id": "68ebe09ff17e2f28c3b8c829",
                "externalId": "IDE-1747297530253-1760288927644",
                "isReusable": false
            },
            {
                "parentExternalId": "IDE-1747326100274",
                "_id": "68ebe09ff17e2f28c3b8c83a",
                "externalId": "IDE-1747326100274-1760288927770",
                "isReusable": false
            }
        ],
        "failedTemplates": []
    }
    }
	 */
	async createChildProjectTemplate(req) {
		return new Promise(async (resolve, reject) => {
			try {
				// Call helper to create child project templates
				let projectTemplates = await projectTemplatesHelper.createChildProjectTemplate(
					req.body.projectTemplateExternalIds,
					req.userDetails,
					req.query.programExternalId ? req.query.programExternalId : '',
					req.query.isExternalProgram ? req.query.isExternalProgram : true,
					req.query.entityType ? req.query.entityType : ''
				)

				// Maintain both `data` and `result` for downstream compatibility
				projectTemplates.result = projectTemplates.data

				return resolve(projectTemplates)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}

	/**
	 * Project templates the daily nudges in brac-utility-service look at (internal access only)
	 * @method
	 * @name nudgeCandidates
	 * @param {Object} req - request data.
	 * @param {String} req.query.tenantId - tenant code.
	 * @returns {JSON} every template of the tenant with how many projects were created from it.
	 */
	async nudgeCandidates(req) {
		return new Promise(async (resolve, reject) => {
			try {
				const projectTemplates = await projectTemplatesHelper.nudgeCandidates(req.query.tenantId)
				projectTemplates.result = projectTemplates.data
				return resolve(projectTemplates)
			} catch (error) {
				return reject({
					status: error.status || HTTP_STATUS_CODE.internal_server_error.status,
					message: error.message || HTTP_STATUS_CODE.internal_server_error.message,
				})
			}
		})
	}
}
