const dayjs = require('dayjs')
const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const NoteModel = require('./NoteModel')
const destroySession = require('./SessionModel')

const LoginSchema = new mongoose.Schema({
    code: { type: String, required: true },
    password: { type: String, required: true },
    lastLogin: { type: Date, required: true }
})

const LoginModel = mongoose.model('Login', LoginSchema)

class Login {
    constructor(body) {
        this.body = body
        this.errors = []
        this.user = null
    }

    async login() {
        this.validate()
        if (this.errors.length > 0) return
        this.user = await LoginModel.findOne({ code: this.body.code })

        if (!this.user) {
            this.errors.push('Código não cadastrado.')
            return
        }

        if (!bcryptjs.compareSync(this.body.password, this.user.password)) {
            this.errors.push('Senha inválida.')
            this.user = null
            return
        }
    }

    async register() {
        this.validate()
        if (this.errors.length > 0) return

        await this.codeExists()
        if (this.errors.length > 0) return

        const salt = bcryptjs.genSaltSync()
        this.body.password = bcryptjs.hashSync(this.body.password, salt)
        this.user = await LoginModel.create(this.body)
    }

    async codeExists() {
        this.user = await LoginModel.findOne({ code: this.body.code })
        if (this.user) this.errors.push('Já existe um código como esse.')
    }

    validate() {
        this.cleanUp()

        if (this.body.code.length < 1 || !this.body.code.length > 6) {
            this.errors.push('O código deve ter entre 1 e 6 caracteres.')
        }

        if (this.body.password.length < 4 || !this.body.password.length > 8) {
            this.errors.push('A senha deve ter entre 4 e 8 caracteres.')
        }
    }

    cleanUp() {
        for (const key in this.body) {
            if (typeof this.body[key] !== 'string') {
                this.body[key] = ''
            }
        }

        this.body = {
            code: this.body.code.toUpperCase(),
            password: this.body.password,
            lastLogin: Date.now()
        }
    }

    static async updateUser(userId) {
        await LoginModel.findOneAndUpdate({ _id: userId }, { lastLogin: Date.now() }, { new: true })
    }

    static async deleteOld() {
        const user = await LoginModel.find()

        user.forEach(async user => {
            const lastLogin = dayjs(user.lastLogin)

            if (dayjs().diff(lastLogin, 'week') >= 1) {
                await LoginModel.findOneAndDelete({ _id: user._id })

                const userNotes = await NoteModel.searchNotes(user._id)
                userNotes.forEach(async uNote => {
                    await NoteModel.delete(uNote._id, user._id)
                })

                await destroySession(user._id)
            }
        })
    }
}

module.exports = Login