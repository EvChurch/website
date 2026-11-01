## Open the finance view

[Open reimbursements](/members/reimbursements) and sign in with your finance account. Your finance access comes from the church's configured finance group. Complete personal payment settings on your first visit to access reports and reviews.

Finance can see submitted reports across purposes. Open [**Approvals**](/members/reimbursements/approvals) to see **Awaiting your approval** first, followed by other **Active reports**. Older reports are available through **Show older**.

**Pastor Expense Account** is one shared purpose available to anyone submitting reimbursements. These claims come straight to finance without purpose approval, including when resubmitted after rejection.

## Complete finance approval

1. Open a report awaiting finance approval.
2. Review the campus, purpose, categories, expense reasons, dates, and amounts. Turn on the **Advanced** slider above the expenses to view Net, Gross, and each line's GST treatment. Check **Bank account** for this submission's payout account; the claimant may have chosen a different account for this report.
3. Use **Show receipt** on mobile or the eye icon on a computer to view each receipt.
4. Choose **Approve**, or select the checkboxes on the left of expenses that need changing, enter one overall reason in **Reason or note**, and choose **Reject**. You can reject without selecting expenses for a report-wide issue. Clear all selected checkboxes before approving.

Bank account numbers are masked by default. Choose the eye icon beside the number to reveal it, and the eye-with-a-slash icon to hide it again. Finance sees the payout details saved with this submission. Only the claimant can edit their saved account or choose a different account before submitting; changing payment settings later does not change a submitted report.

Turn **Advanced** off to return to the single **Amount** column. It changes only your view. **Activity** shows recorded actions and is hidden when empty.

Rejection returns the whole report to the claimant, with selected expenses highlighted and recorded in Activity alongside the overall reason. They can edit the entire report, including unflagged expenses. Nothing can be paid until the whole report is approved.

![A sample finance review with the second expense selected and one overall rejection reason.](/images/help/reject-expense-lines.png)

After they edit and resubmit, ordinary purposes go through purpose approval and then finance approval again. Pastor Expense Account returns directly to finance.

![A sample finance review with the submitted bank account revealed.](/images/help/finance-expense.png)

Categories cannot be changed during finance review. If something needs correcting, reject the report with a clear explanation. Finance approval must be provided by someone other than the claimant and the person who gave purpose approval.

## Arrange payment

Open the [**Payment queue**](/members/reimbursements/payment-queue) to see reports ready for payment.

After finance approval, the report moves to **Awaiting payment**. Finance receives an email with payment details and a PDF expense summary. For ordinary purposes, the purpose approver receives a summary without bank details. The PDF records the campus and purpose and includes the expenses in a table, followed by the receipts. Shared receipts appear once. Receipt pages contain the uploaded image or original PDF pages, without added headings or branding. Receipts can also be viewed through the website.

Make the bank payment outside the website using the supplied payment details. The website does not transfer money or send the claim to an accounting system.

If a report awaiting payment needs changes, open it, enter a reason, and choose **Return for changes**. The claimant must correct and resubmit it through the approval process.

## Confirm completed payments

1. Open **Payment queue**.
2. Select the reports you have paid. On mobile, select individual report cards or use **Select all**. On a computer, use the checkbox at the top of the table or select individual rows.
3. Check the selected count and total.
4. Choose **Confirm Payment**.

The button is available only when at least one report is selected. Confirmation marks the selected reports as **Paid** and sends the claimant a payment confirmation. Only confirm payments you have actually completed.

![A sample payment queue with two selected reports, their combined total, and the Confirm Payment button.](/images/help/payment-queue.png)

Paid reports are read-only and appear under **Show older**. Activity records who confirmed payment and when. There are no payment reference, payment date, or batch fields to fill out.

## Manage reimbursement settings

Finance and website administrators manage reimbursement settings in the **Payload admin panel**. They can add, rename, or archive expense categories and configure the senior pastor, alternate approver, and finance notification email. **Minimum report amount (NZD)** sets the total including GST required to submit any report. It defaults to **$25**. Claimants can save drafts below the minimum, but cannot submit them. Changes apply to new submissions and resubmissions.

The Campus dropdown uses the active campuses configured on the website. Each submitted report keeps its recorded campus name in emails, its PDF, and submission history. Older reports without a campus show **Not recorded**; claimants must choose an active campus before submitting or resubmitting.

Ordinary purposes and finance membership come from Rock. The shared Pastor Expense Account is managed by the website and remains available independently of Rock purpose assignments. Pending purpose approvals follow the current assignment in Rock; approvals already completed remain valid.

[Contact us](/contact) if you cannot access finance functions or need help with a paid report.

## API access

Finance scripts can retrieve reports and receipts, approve or reject reports, and
confirm payments through the reimbursement REST API v1. A Payload administrator
must create a key for a named person in **API keys** in the admin
panel. Finance access alone does not allow someone to create keys.

Choose a descriptive name, enter the person’s Rock person ID, select the permissions the
script needs, and choose an expiry date or **No expiry**. The default is one year.
Save the record, choose **Generate API key**, save the displayed secret securely,
then choose **Dismiss secret**. It cannot be displayed again. Admins can edit permissions and expiry,
review last-used time and recent audit activity, or tick **Revoke key** and save. To
replace a key, create another, update the script, then revoke the old one.

Open **API → API audit** to review key changes and API activity.

A key cannot do more than its named person currently may do. Report reading,
receipt/PDF downloads, bank details, approval/rejection, and payment confirmation
are separate permissions. Changes to permissions and revocation apply to subsequent
requests. Scripts produce the normal emails and report history, with the API key
recorded alongside the person who acted.

Payment confirmation records payments made outside the website. Individual and
batch confirmation use the same endpoint. Every report in a batch must be ready
for payment; otherwise none are confirmed. Scripts must use report versions and
unique operation IDs so retries cannot duplicate decisions or notifications.

The [interactive Swagger documentation](/api/v1/docs) lets you browse endpoints and
try requests with an API key. Choose **Authorize** and enter the key without
`Bearer`. **Try it out** sends real requests, including approval and payment
changes; entered keys are cleared when the page reloads.

The [OpenAPI specification](/api/v1/openapi.json) describes the
endpoints, permission requirements, filters, request bodies, and errors. Ask the
website team for the developer guide and runnable examples when setting up a
script. No additional API access has been enabled for anyone automatically.
