/**
 * name : changeRequests.js
 * Description : change requests helper for DB interactions.
 */
module.exports = class ChangeRequests {
	/**
	 * Create a change request.
	 * @method
	 * @name create
	 * @param {Object} data - change request data.
	 * @returns {Object} created change request document.
	 */
	static create(data) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.changeRequests.create(data)
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Find a single change request document.
	 * @method
	 * @name findOne
	 * @param {Object} filterData - filter criteria.
	 * @returns {Object} change request document.
	 */
	static findOne(filterData = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.changeRequests.findOne(filterData).lean()
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Find a change request document by id.
	 * @method
	 * @name findById
	 * @param {String} id - change request id.
	 * @returns {Object} change request document.
	 */
	static findById(id) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.changeRequests.findOne({ _id: id }).lean()
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * List change requests with pagination.
	 * @method
	 * @name list
	 * @param {Object} filterData - filter criteria.
	 * @param {Number} pageNo - page number.
	 * @param {Number} pageSize - page size.
	 * @returns {Object} { data, count }.
	 */
	static list(filterData = {}, pageNo = 1, pageSize = 100) {
		return new Promise(async (resolve, reject) => {
			try {
				let skip = (pageNo - 1) * pageSize
				filterData = Object.fromEntries(
					Object.entries(filterData).filter(([, value]) => value != null && String(value).trim() !== '')
				)
				let [data, count] = await Promise.all([
					database.models.changeRequests
						.find(filterData)
						.sort({ createdAt: -1 })
						.skip(skip)
						.limit(pageSize)
						.lean(),
					database.models.changeRequests.countDocuments(filterData),
				])

				return resolve({ data, count })
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Find all change request documents matching a filter, without pagination.
	 * @method
	 * @name findAll
	 * @param {Object} filterData - filter criteria.
	 * @returns {Array} matching change request documents.
	 */
	static findAll(filterData = {}) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.changeRequests.find(filterData).sort({ createdAt: -1 }).lean()
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}

	/**
	 * Update a change request by id.
	 * @method
	 * @name updateById
	 * @param {String} id - change request id.
	 * @param {Object} updateData - data to update.
	 * @returns {Object} updated change request document.
	 */
	static updateById(id, updateData) {
		return new Promise(async (resolve, reject) => {
			try {
				let result = await database.models.changeRequests.findOneAndUpdate({ _id: id }, updateData, {
					new: true,
				})
				return resolve(result)
			} catch (error) {
				return reject(error)
			}
		})
	}
}
