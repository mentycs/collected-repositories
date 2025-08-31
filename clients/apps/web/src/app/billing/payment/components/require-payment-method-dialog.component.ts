import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CalloutTypes,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SharedModule } from "../../../shared";
import { BitwardenSubscriber } from "../../types";

import { EnterPaymentMethodComponent } from "./enter-payment-method.component";
import {
  SubmitPaymentMethodDialogComponent,
  SubmitPaymentMethodDialogResult,
} from "./submit-payment-method-dialog.component";

type DialogParams = {
  subscriber: BitwardenSubscriber;
  callout: {
    type: CalloutTypes;
    title: string;
    message: string;
  };
};

@Component({
  template: `
    <form [formGroup]="formGroup" [bitSubmit]="submit">
      <bit-dialog>
        <span bitDialogTitle class="tw-font-semibold">
          {{ "addPaymentMethod" | i18n }}
        </span>
        <div bitDialogContent>
          <bit-callout [type]="dialogParams.callout.type" [title]="dialogParams.callout.title">
            {{ dialogParams.callout.message }}
          </bit-callout>
          <app-enter-payment-method [group]="formGroup" [includeBillingAddress]="true">
          </app-enter-payment-method>
        </div>
        <ng-container bitDialogFooter>
          <button bitButton bitFormButton buttonType="primary" type="submit">
            {{ "save" | i18n }}
          </button>
        </ng-container>
      </bit-dialog>
    </form>
  `,
  standalone: true,
  imports: [EnterPaymentMethodComponent, SharedModule],
  providers: [SubscriberBillingClient],
})
export class RequirePaymentMethodDialogComponent extends SubmitPaymentMethodDialogComponent {
  protected override subscriber: BitwardenSubscriber;

  constructor(
    billingClient: SubscriberBillingClient,
    @Inject(DIALOG_DATA) protected dialogParams: DialogParams,
    dialogRef: DialogRef<SubmitPaymentMethodDialogResult>,
    i18nService: I18nService,
    toastService: ToastService,
  ) {
    super(billingClient, dialogRef, i18nService, toastService);
    this.subscriber = this.dialogParams.subscriber;
  }

  static open = (dialogService: DialogService, dialogConfig: DialogConfig<DialogParams>) =>
    dialogService.open<SubmitPaymentMethodDialogResult>(RequirePaymentMethodDialogComponent, {
      ...dialogConfig,
      disableClose: true,
    });
}
