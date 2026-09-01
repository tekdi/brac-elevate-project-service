/**
 * name : producer.js
 * author : Aman Karki
 * created-date : 08-Sep-2020
 * Description : Kafka Producer related information.
 */

// Dependencies
const kafkaCommunicationsOnOff =
	!process.env.KAFKA_COMMUNICATIONS_ON_OFF || process.env.KAFKA_COMMUNICATIONS_ON_OFF != 'OFF' ? 'ON' : 'OFF'
const projectSubmissionTopic =
	process.env.PROJECT_SUBMISSION_TOPIC && process.env.PROJECT_SUBMISSION_TOPIC != 'OFF'
		? process.env.PROJECT_SUBMISSION_TOPIC
		: 'sl-improvement-project-submission-dev'
const userProjectActivityTopic =
	process.env.USER_ACTIVITY_TOPIC && process.env.USER_ACTIVITY_TOPIC != 'OFF'
		? process.env.USER_ACTIVITY_TOPIC
		: 'user-activities'
const programOperationTopic =
	process.env.PROGRAM_USER_MAPPING_TOPIC && process.env.PROGRAM_USER_MAPPING_TOPIC != 'OFF'
		? process.env.PROGRAM_USER_MAPPING_TOPIC
		: 'elevate_program_operation'
const pushDeletedResourceTopic =
	process.env.RESOURCE_DELETION_TOPIC && process.env.RESOURCE_DELETION_TOPIC != 'OFF'
		? process.env.RESOURCE_DELETION_TOPIC
		: 'resource_deletion_topic'
const userCoursesTopic = process.env.USER_COURSES_TOPIC
const changeRequestTopic =
	process.env.CHANGE_REQUEST_TOPIC && process.env.CHANGE_REQUEST_TOPIC != 'OFF'
		? process.env.CHANGE_REQUEST_TOPIC
		: 'elevate_change_request'

/**
 * Push improvement projects to kafka.
 * @function
 * @name pushProjectToKafka
 * @param {Object} message - Message data.
 */

const pushProjectToKafka = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: projectSubmissionTopic,
					messages: JSON.stringify(message),
				},
			])

			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

//pushUserActivitiesToKafka

const pushUserActivitiesToKafka = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: userProjectActivityTopic,
					messages: JSON.stringify(message),
				},
			])

			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Push resource deleted data to kafka.
 * @function
 * @name pushResourceDeleteKafkaEvent
 * @param {Object} message - Message data.
 */

const pushResourceDeleteKafkaEvent = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: pushDeletedResourceTopic,
					messages: JSON.stringify(message),
				},
			])

			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Push message to kafka.
 * @function
 * @name pushMessageToKafka
 * @param {Object} payload - Payload data.
 */

const pushMessageToKafka = function (payload) {
	return new Promise((resolve, reject) => {
		if (kafkaCommunicationsOnOff != 'ON') {
			throw reject('Kafka configuration is not done')
		}

		// console.log('-------Kafka producer log starts here------------------')
		// console.log('Topic Name: ', payload[0].topic)
		// console.log('Message: ', JSON.stringify(payload))
		// console.log('-------Kafka producer log ends here------------------')

		kafkaClient.kafkaProducer.send(payload, (err, data) => {
			if (err) {
				return reject('Kafka push to topic ' + payload[0].topic + ' failed.')
			} else {
				return resolve(data)
			}
		})
	})
		.then((result) => {
			return {
				status: CONSTANTS.common.SUCCESS,
				message:
					'Kafka push to topic ' +
					payload[0].topic +
					' successful with number - ' +
					result[payload[0].topic][0],
			}
		})
		.catch((err) => {
			return {
				status: 'failed',
				message: err,
			}
		})
}
/**
 * Push program operation event to Kafka.
 * @function
 * @name pushProgramOperationEvent
 * @param {Object} message - The message payload to be pushed to Kafka.
 * @returns {Promise<Object>} Kafka push status response.
 */
const pushProgramOperationEvent = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: programOperationTopic,
					messages: JSON.stringify(message),
				},
			])

			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Push userCourses event to Kafka.
 * @function
 * @name pushUserCoursesToKafka
 * @param {Object} message - The message payload to be pushed to Kafka.
 * @returns {Promise<Object>} Kafka push status response.
 */
const pushUserCoursesToKafka = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: userCoursesTopic,
					messages: JSON.stringify(message),
				},
			])
			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Push change request event to Kafka (created/approved/rejected notifications).
 * @function
 * @name pushChangeRequestEvent
 * @param {Object} message - The message payload to be pushed to Kafka.
 * @returns {Promise<Object>} Kafka push status response.
 */
const pushChangeRequestEvent = function (message) {
	return new Promise(async (resolve, reject) => {
		try {
			let kafkaPushStatus = await pushMessageToKafka([
				{
					topic: changeRequestTopic,
					messages: JSON.stringify(message),
				},
			])

			return resolve(kafkaPushStatus)
		} catch (error) {
			return reject(error)
		}
	})
}

module.exports = {
	pushProjectToKafka: pushProjectToKafka,
	pushUserActivitiesToKafka: pushUserActivitiesToKafka,
	pushProgramOperationEvent: pushProgramOperationEvent,
	pushResourceDeleteKafkaEvent: pushResourceDeleteKafkaEvent,
	pushUserCoursesToKafka: pushUserCoursesToKafka,
	pushChangeRequestEvent: pushChangeRequestEvent,
}
