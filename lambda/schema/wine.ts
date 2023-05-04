import Joi from "joi";

export interface IWine {
    name: string
    style: string
    country: string
    region: string
    vineyard: string
    vintage: number
    score: number
    flavourProfile: string[]
}

const wineSchema = Joi.object<IWine>({
    name: Joi.string().required(),
    style: Joi.string().required(),
    country: Joi.string().required(),
    region: Joi.string().required(),
    vineyard: Joi.string().required(),
    vintage: Joi.number().min(1800).max(new Date().getFullYear() + 1).required(),
    score: Joi.number().min(0).max(100).required(),
    flavourProfile: Joi.array().items(Joi.string()).required(),
});

export default wineSchema
