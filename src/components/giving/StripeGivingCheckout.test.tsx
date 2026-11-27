// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StripeGivingCheckout } from './StripeGivingCheckout'

const sdk=vi.hoisted(()=>({mode:'success' as 'success'|'loading'|'error',confirm:vi.fn()}))
vi.mock('@stripe/stripe-js',()=>({loadStripe:()=>Promise.resolve(null)}))
vi.mock('@stripe/react-stripe-js/checkout',()=>({
  CheckoutElementsProvider:({children}:{children:ReactNode})=>children,
  ExpressCheckoutElement:()=> <div>Wallet options</div>,
  PaymentElement:()=> <div>Card fields</div>,
  useCheckoutElements:()=>sdk.mode==='success'?{type:'success',checkout:{confirm:sdk.confirm}}:{type:sdk.mode},
}))
;(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
let container:HTMLDivElement,root:Root
beforeEach(()=>{sdk.mode='success';sdk.confirm.mockReset();container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());container.remove()})
async function render(onCancel:()=>void,onComplete=vi.fn()){
  await act(async()=>root.render(<StripeGivingCheckout publishableKey="pk_test_example" clientSecret="cs_test_example_secret_fixture" recurring={false} onCancel={onCancel} onComplete={onComplete}/>))
}
function cancelButton(){return [...container.querySelectorAll('button')].find(button=>button.textContent==='Cancel')!}

it('puts Cancel below Give now and returns without confirming a payment',async()=>{
  const onCancel=vi.fn()
  await render(onCancel)
  expect([...container.querySelectorAll('button')].map(button=>button.textContent)).toEqual(['Give now','Cancel'])
  expect(cancelButton().type).toBe('button')
  await act(async()=>cancelButton().click())
  expect(onCancel).toHaveBeenCalledOnce()
  expect(sdk.confirm).not.toHaveBeenCalled()
})

it('prevents cancellation during confirmation and enables it again after a definitive error',async()=>{
  let finish!:(value:{type:'error';error:{message:string}})=>void
  sdk.confirm.mockReturnValueOnce(new Promise(resolve=>{finish=resolve}))
  const onCancel=vi.fn(),onComplete=vi.fn()
  await render(onCancel,onComplete)
  await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
  expect(cancelButton().disabled).toBe(true)
  await act(async()=>cancelButton().click())
  expect(onCancel).not.toHaveBeenCalled()
  await act(async()=>finish({type:'error',error:{message:'Check your card details'}}))
  expect(onComplete).not.toHaveBeenCalled()
  expect(cancelButton().disabled).toBe(false)
  await act(async()=>cancelButton().click())
  expect(onCancel).toHaveBeenCalledOnce()
})

it.each(['loading','error'] as const)('offers Cancel when card entry is %s',async mode=>{
  sdk.mode=mode
  const onCancel=vi.fn()
  await render(onCancel)
  await act(async()=>cancelButton().click())
  expect(onCancel).toHaveBeenCalledOnce()
  expect(sdk.confirm).not.toHaveBeenCalled()
})
