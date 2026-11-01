// This document is also served at /api/v1/openapi.json.
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const uuid = { type: 'string', format: 'uuid' }
const nullableString = { type: ['string','null'] }
const version = { type: 'integer', minimum: 1 }
const json = (schema: object) => ({ 'application/json': { schema } })
const object = (properties: Record<string,object>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required })
const errorResponses = Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status => [String(status), { description: ({400:'Invalid input',401:'Invalid, expired, or revoked key',403:'Missing scope or current authority',404:'Not found or not visible',409:'Stale version or conflicting idempotency key',413:'Request exceeds 64 KB',415:'Expected application/json',429:'120 requests per minute per key; wait Retry-After seconds',503:'Service or identity verification unavailable'} as Record<number,string>)[status],content:json(ref('Error')),...(status===429?{headers:{'Retry-After':{schema:{type:'integer'},description:'Seconds before retrying'}}}:{}) }]))
const idParameter = { name:'reportId',in:'path',required:true,schema:uuid }
const operationParameter = { name:'Idempotency-Key',in:'header',required:true,description:'Unique operation ID (1–128 letters, digits, underscores or hyphens), retained for the lifetime of the key. Retry identical requests with the same value. A different body or path with this value returns 409. Failed operations are rolled back and may be retried.',schema:{type:'string',minLength:1,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'} }
const get = (operationId:string,summary:string,scopes:string[],schema:object,parameters:object[]=[]) => ({operationId,summary,tags:['Reimbursements'],'x-required-scopes':scopes,parameters,responses:{'200':{description:'Success',content:json(schema)},'304':{description:'Unchanged, when If-None-Match matches the ETag'},...errorResponses}})
const post = (operationId:string,summary:string,scope:string,input:object,output:object,parameters:object[]=[]) => ({operationId,summary,tags:['Reimbursements'],'x-required-scopes':[scope],parameters:[...parameters,operationParameter],requestBody:{required:true,content:json(input)},responses:{'200':{description:'Completed, or the original successful result for an identical retry',content:json(output)},...errorResponses}})
const binary = (operationId:string,summary:string,parameters:object[],mediaTypes:string[]) => ({operationId,summary,tags:['Reimbursements'],'x-required-scopes':['reimbursements:receipts:read'],parameters,responses:{'200':{description:'Download; report visibility is checked. PDFs include bank details only with reimbursements:bank:read and current bank access.',content:Object.fromEntries(mediaTypes.map(type=>[type,{schema:{type:'string',format:'binary'}}]))},...errorResponses}})
const etagParameter = {name:'If-None-Match',in:'header',schema:{type:'string'},description:'ETag from a prior response. Authorization is checked before returning 304.'}
export const openApi = {
  openapi:'3.1.1',
  info:{title:'Ev Church API',version:'1.0.0',license:{name:'GNU General Public License v3.0 only',identifier:'GPL-3.0-only'},description:'API v1 uses namespaced paths under /api/v1. Personal API keys are created by Payload admins. Permissions are intersected with the linked Rock person’s current access. API actions use the same approval rules and notifications as the website. Payment confirmation records an external payment; it never transfers money. Amounts are NZD integer minor units (cents). No claim editing, submission, or settings endpoints are exposed.'},
  servers:[{url:'/api/v1'}],tags:[{name:'Reimbursements',description:'Retrieve claims and receipts, review reports, and confirm external payments.'}],security:[{apiKey:[]}],
  paths:{
    '/reimbursements/reports':{get:get('listReports','Poll visible reports in updated-time order',['reimbursements:reports:read'],ref('ReportPage'),[
      {name:'status',in:'query',schema:ref('Status')},{name:'updatedSince',in:'query',schema:{type:'string',format:'date-time'},description:'Inclusive lower bound. After reading all pages, use an overlapping lookback from syncUntil for the next poll. Periodically refresh without this filter for late commits and visibility changes; work queues can poll all reports in the target status.'},
      {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:50}},{name:'cursor',in:'query',schema:{type:'string',maxLength:2048},description:'Opaque nextCursor from the prior response; keep status and updatedSince unchanged.'},etagParameter])},
    '/reimbursements/reports/{reportId}':{get:get('getReport','Retrieve a visible report',['reimbursements:reports:read'],ref('Report'),[idParameter,etagParameter])},
    '/reimbursements/reports/{reportId}/receipts/{expenseId}':{get:binary('downloadReceipt','Download a receipt',[idParameter,{name:'expenseId',in:'path',required:true,schema:uuid}],['application/pdf','image/jpeg','image/png','image/webp'])},
    '/reimbursements/reports/{reportId}/pdf':{get:binary('downloadReportPdf','Download the report PDF',[idParameter],['application/pdf'])},
    '/reimbursements/reports/{reportId}/approve':{post:post('approveReport','Approve at the current approval stage','reimbursements:reports:review',ref('Review'),ref('DecisionResult'),[idParameter])},
    '/reimbursements/reports/{reportId}/reject':{post:post('rejectReport','Reject the whole report, optionally flagging expenses','reimbursements:reports:review',ref('Rejection'),ref('DecisionResult'),[idParameter])},
    '/reimbursements/payments/confirm':{post:post('confirmPayments','Confirm one or several external payments atomically','reimbursements:payments:confirm',ref('PaymentConfirmation'),object({reports:{type:'array',items:object({id:uuid,version,status:{const:'paid'}})}}))},
  },
  components:{securitySchemes:{apiKey:{type:'http',scheme:'bearer',bearerFormat:'ev_api_…',description:'Scopes: reimbursements:reports:read, reimbursements:receipts:read, reimbursements:bank:read, reimbursements:reports:review, reimbursements:payments:confirm. Bank details require reimbursements:bank:read in addition to the report or PDF permission. Supply Authorization: Bearer YOUR_KEY. Never put the key in a URL.'}},schemas:{
    Status:{type:'string',enum:['draft','rc-approval','finance-approval','rejected','awaiting-payment','paid','cancelled']},
    Error:object({error:object({code:{type:'string'},message:{type:'string'}})}),
    Review:object({version,reason:{type:'string',maxLength:2000,default:''}},['version']),
    Rejection:object({version,reason:{type:'string',minLength:1,maxLength:2000},rejectedLineIds:{type:'array',maxItems:100,uniqueItems:true,items:uuid,default:[]}},['version','reason']),
    DecisionResult:object({id:uuid,version}),
    PaymentConfirmation:object({reports:{type:'array',minItems:1,maxItems:100,items:object({id:uuid,version}),description:'Every report must be approved and awaiting payment at its expected version. Duplicate IDs are rejected. One invalid report rolls back the whole batch.'}}),
    ReportPage:object({data:{type:'array',items:ref('Report')},nextCursor:nullableString,syncUntil:{type:'string',format:'date-time',description:'The poll’s upper bound, held across pages. Use an overlapping lookback from this after reading all pages. This is a current-state query, not a change feed; periodically refresh without a time filter. Deduplicate by report ID/version.'}}),
    Report:object({
      id:uuid,number:{type:'integer'},status:ref('Status'),version,revision:{type:'integer'},
      claimant:object({id:{type:'integer'},name:{type:'string'},email:{type:'string'}}),
      campus:object({id:{type:['integer','null']},name:{type:'string'}}),purpose:object({id:{type:['integer','null']},name:{type:'string'}}),
      currency:{const:'NZD'},totalMinor:{type:'integer'},bankAccount:{oneOf:[{type:'null'},object({name:{type:'string'},number:{type:'string'}})],description:'Null unless both the key and linked person may read bank details.'},
      expenses:{type:'array',items:object({id:uuid,date:{type:'string'},categoryId:{type:['integer','null']},categoryName:{type:'string'},expenseReason:{type:'string'},amountMinor:{type:['integer','null']},hasGst:{type:'boolean'},receiptUrl:nullableString})},
      history:{type:'array',items:object({at:{type:'string',format:'date-time'},personId:{type:'integer'},name:{type:'string'},action:{type:'string'},reason:{type:'string'},revision:{type:'integer'},apiKey:{oneOf:[{type:'null'},object({id:uuid,name:{type:'string'}})]},rejectedLines:{type:'array',items:object({id:uuid,number:{type:'integer'},expenseReason:{type:'string'}})}})},
      permissions:object({review:{type:'boolean'},confirmPayment:{type:'boolean'}}),pdfUrl:nullableString,createdAt:{type:'string',format:'date-time'},updatedAt:{type:'string',format:'date-time'},
    }),
  }},
} as const
