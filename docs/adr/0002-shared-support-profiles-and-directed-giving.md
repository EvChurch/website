# Shared support profiles own content and recipient email

About currently stores apprentice content in manual page cards, separately from giving funds and Rock-synced team records. Use church-managed support profiles for apprentices and student ministers, owning each person's name, photo, blurb, and contact email; link the existing giving fund to its profile. About and the launcher use the same profile, and fund notifications use its email rather than maintaining a second recipient address on the fund. This reuses church-published content without introducing separately editable personalised giving pages.

A shareable link such as `/?launcher=give-liz-halliday` opens the mini profile with a “Give Now” button. A Give action on About opens the giving flow directly because the visitor has already seen that content. Both paths fix the designated fund throughout the directed giving flow and display it above the amount question.

Starting directed giving takes precedence over an unfinished giving draft without a conflict prompt. The donor's designated fund must remain the one selected by the directed entry.

Notify the linked profile when a donor completes verified BlinkPay recurring setup or a successful single gift, including donor name and email, fund, gift amount, transaction fee and total, frequency, applicable start date, and completion time without an additional donor consent step. Recurring setup must be described as an authorised arrangement rather than a successful payment. Subsequent recurring payment notifications and retired-fund handling are outside this feature's scope.

Support notifications follow the completed checkout's fund regardless of whether the donor entered through a profile link, About, or the regular giving launcher. Each qualifying checkout produces one support notification, using the existing reliable email delivery mechanism.

Public profile visibility requires a photo, blurb, and email. Notifications require a fund-linked profile with an email, independently of public visibility. Migrating About preserves incomplete manual cards and historical page snapshots; student minister profiles without existing content remain unpublished until their details are entered.
