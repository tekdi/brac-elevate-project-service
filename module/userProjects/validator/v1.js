/**
 * name : v1.js
 * author : Aman
 * created-date : 25-Aug-2020
 * Description : Projects.
 */

module.exports = (req) => {
	let projectsValidator = {
		sync: function () {
			req.checkParams('_id').exists().withMessage('required project id')
			req.checkQuery('lastDownloadedAt').exists().withMessage('required last downloaded at')
		},
		tasksStatus: function () {
			req.checkParams('_id').exists().withMessage('required project id')
		},
		solutionDetails: function () {
			req.checkParams('_id').exists().withMessage('required project id')
			req.checkQuery('taskId').exists().withMessage('required task id')
		},
		add: function () {
			req.checkBody('program.name').exists().withMessage('required program name')
			req.checkBody('program.source')
				.exists()
				.withMessage('required program source')
				.custom((source) => {
					// Check if 'source' exists and is a non-empty object
					if (typeof source !== 'object' || source === null || !(Object.keys(source).length > 0)) {
						return false
					}
					return true
				})
				.withMessage('program source cannot be null or empty')
			req.checkBody('projects')
				.isArray()
				.withMessage('projects must be an array')
				.custom((projects) => {
					if (!projects || !Array.isArray(projects)) {
						return false // 'projects' is not an array
					}

					// Validate each project
					return projects.every((project) => {
						// Validate that the project has a 'source'
						if (!project.hasOwnProperty('source')) {
							return false
						}

						if (!(Object.keys(project['source']).length > 0)) {
							return false
						}

						// Validate 'tasks' if it exists
						if (project.tasks) {
							// Ensure 'tasks' is an array
							if (!Array.isArray(project.tasks)) {
								return false // 'tasks' exists but is not an array
							}

							// Ensure each task has a 'source'
							return project.tasks.every((task) => task.hasOwnProperty('source'))
						}

						// No 'tasks', just validate 'source'
						return true
					})
				})
				.withMessage('each project and each task in the project must have a source, and tasks must be an array')

			// req.checkBody('program.startDate').exists().withMessage('required program start date')
			// req.checkBody('program.conversation').exists().withMessage('required program conversation')
			// req.checkBody('projects')
			// 	.exists()
			// 	.withMessage('required projects array')
			// 	.isArray()
			// 	.withMessage('projects must be an array')
		},
		addStory: function () {
			req.checkParams('_id').exists().withMessage('required project id')
			req.checkBody('story')
				.exists()
				.withMessage('Story key is required')
				.custom((value) => {
					if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
						throw new Error('Story key should not be an empty object')
					}
					return true
				})
		},
		share: function () {
			req.checkParams('_id').exists().withMessage('required project id')
		},
		certificateReIssue: function () {
			req.checkParams('_id').exists().withMessage('required project id')
		},
		verifyCertificate: function () {
			req.checkParams('_id').exists().withMessage('required project id')
		},
		update: function () {
			req.checkParams('_id').exists().withMessage('required project id')
		},
		deleteUserPIIData: function () {
			req.checkBody('id').exists().withMessage('required id of the user')
		},
		pushSubmissionToTask: function () {
			req.checkParams('_id').exists().withMessage('required project id'),
				req.checkQuery('taskId').exists().withMessage('required task id')
		},
		addEntity: function () {
			// Validate path param: id
			req.checkParams('_id')
				.exists()
				.withMessage('projectId is required in path params')
				.isMongoId()
				.withMessage('projectId must be a valid MongoDB ObjectId')

			// Validate body param: entityId
			req.checkBody('entityId')
				.exists()
				.withMessage('entityId is required in request body')
				.isMongoId()
				.withMessage('entityId must be a valid MongoDB ObjectId')
		},
		searchEntities: function () {
			let existId = 'solutionId,projectId'
			if (req.query.solutionId) {
				existId = 'solutionId'
			}

			if (req.query.projectId) {
				existId = 'projectId'
			}
			req.checkQuery(existId).exists().withMessage('required solution or projectId Id')
		},
		createProjectPlan: function () {
			// Validate templates array
			req.checkBody('templates')
				.exists()
				.withMessage('templates array is required')
				.isArray()
				.withMessage('templates must be an array')
				.custom((templates) => {
					if (!templates || templates.length === 0) {
						throw new Error('templates array cannot be empty')
					}
					return templates.every((template) => {
						if (!template.templateId) {
							throw new Error('Each template must have a templateId')
						}
						if (
							template.categoryId === undefined ||
							template.categoryId === null ||
							String(template.categoryId).trim() === ''
						) {
							throw new Error(`Each template must have a categoryId (templateId: ${template.templateId})`)
						}
						return true
					})
				})

			// Validate userId - must be provided and not empty
			req.checkBody('userId')
				.exists()
				.withMessage('userId is required')
				.notEmpty()
				.withMessage('userId cannot be empty')

			// Validate entityId - must be provided and not empty
			req.checkBody('entityId')
				.exists()
				.withMessage('entityId is required')
				.notEmpty()
				.withMessage('entityId cannot be empty')
		},
	}

	if (projectsValidator[req.params.method]) {
		projectsValidator[req.params.method]()
	}
}
