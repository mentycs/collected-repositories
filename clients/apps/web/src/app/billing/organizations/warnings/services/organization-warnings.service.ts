import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  Subject,
  switchMap,
  tap,
} from "rxjs";
import { take } from "rxjs/operators";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { OrganizationBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";

import {
  TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE,
  TrialPaymentDialogComponent,
} from "../../../shared/trial-payment-dialog/trial-payment-dialog.component";
import { openChangePlanDialog } from "../../change-plan-dialog.component";
import {
  OrganizationFreeTrialWarning,
  OrganizationResellerRenewalWarning,
  OrganizationWarningsResponse,
} from "../types";

const format = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

@Injectable()
export class OrganizationWarningsService {
  private cache$ = new Map<OrganizationId, Observable<OrganizationWarningsResponse>>();

  private refreshFreeTrialWarningTrigger = new Subject<void>();
  private refreshTaxIdWarningTrigger = new Subject<void>();

  private taxIdWarningRefreshedSubject = new BehaviorSubject<TaxIdWarningType | null>(null);
  taxIdWarningRefreshed$ = this.taxIdWarningRefreshedSubject.asObservable();

  constructor(
    private configService: ConfigService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationBillingClient: OrganizationBillingClient,
    private router: Router,
  ) {}

  getFreeTrialWarning$ = (
    organization: Organization,
  ): Observable<OrganizationFreeTrialWarning | null> =>
    merge(
      this.getWarning$(organization, (response) => response.freeTrial),
      this.refreshFreeTrialWarningTrigger.pipe(
        switchMap(() => this.getWarning$(organization, (response) => response.freeTrial, true)),
      ),
    ).pipe(
      map((warning) => {
        if (!warning) {
          return null;
        }

        const { remainingTrialDays } = warning;

        if (remainingTrialDays >= 2) {
          return {
            organization,
            message: this.i18nService.t("freeTrialEndPromptCount", remainingTrialDays),
          };
        }

        if (remainingTrialDays == 1) {
          return {
            organization,
            message: this.i18nService.t("freeTrialEndPromptTomorrowNoOrgName"),
          };
        }

        return {
          organization,
          message: this.i18nService.t("freeTrialEndingTodayWithoutOrgName"),
        };
      }),
    );

  getResellerRenewalWarning$ = (
    organization: Organization,
  ): Observable<OrganizationResellerRenewalWarning | null> =>
    this.getWarning$(organization, (response) => response.resellerRenewal).pipe(
      map((warning) => {
        if (!warning) {
          return null;
        }
        switch (warning.type) {
          case "upcoming": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerRenewalWarningMsg",
                organization.providerName,
                format(warning.upcoming!.renewalDate),
              ),
            };
          }
          case "issued": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerOpenInvoiceWarningMgs",
                organization.providerName,
                format(warning.issued!.issuedDate),
                format(warning.issued!.dueDate),
              ),
            };
          }
          case "past_due": {
            return {
              type: "warning",
              message: this.i18nService.t(
                "resellerPastDueWarningMsg",
                organization.providerName,
                format(warning.pastDue!.suspensionDate),
              ),
            };
          }
        }
      }),
    );

  getTaxIdWarning$ = (organization: Organization): Observable<TaxIdWarningType | null> =>
    merge(
      this.getWarning$(organization, (response) => response.taxId),
      this.refreshTaxIdWarningTrigger.pipe(
        switchMap(() =>
          this.getWarning$(organization, (response) => response.taxId, true).pipe(
            tap((warning) => this.taxIdWarningRefreshedSubject.next(warning ? warning.type : null)),
          ),
        ),
      ),
    ).pipe(map((warning) => (warning ? warning.type : null)));

  refreshFreeTrialWarning = () => this.refreshFreeTrialWarningTrigger.next();

  refreshTaxIdWarning = () => this.refreshTaxIdWarningTrigger.next();

  showInactiveSubscriptionDialog$ = (organization: Organization): Observable<void> =>
    this.getWarning$(organization, (response) => response.inactiveSubscription).pipe(
      filter((warning) => warning !== null),
      switchMap(async (warning) => {
        switch (warning.resolution) {
          case "contact_provider": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: {
                key: "suspendedManagedOrgMessage",
                placeholders: [organization.providerName],
              },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
          case "add_payment_method": {
            const confirmed = await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedOwnerOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("continue"),
              cancelButtonText: this.i18nService.t("close"),
            });
            if (confirmed) {
              const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
                FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
              );
              const route = managePaymentDetailsOutsideCheckout
                ? "payment-details"
                : "payment-method";
              await this.router.navigate(
                ["organizations", `${organization.id}`, "billing", route],
                {
                  state: { launchPaymentModalAutomatically: true },
                },
              );
            }
            break;
          }
          case "resubscribe": {
            const subscription = await this.organizationApiService.getSubscription(organization.id);
            const dialogReference = openChangePlanDialog(this.dialogService, {
              data: {
                organizationId: organization.id,
                subscription: subscription,
                productTierType: organization.productTierType,
              },
            });
            await lastValueFrom(dialogReference.closed);
            break;
          }
          case "contact_owner": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedUserOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
        }
      }),
    );

  showSubscribeBeforeFreeTrialEndsDialog$ = (organization: Organization): Observable<void> =>
    this.getWarning$(organization, (response) => response.freeTrial).pipe(
      filter((warning) => warning !== null),
      switchMap(async () => {
        const organizationSubscriptionResponse = await this.organizationApiService.getSubscription(
          organization.id,
        );

        const dialogRef = TrialPaymentDialogComponent.open(this.dialogService, {
          data: {
            organizationId: organization.id,
            subscription: organizationSubscriptionResponse,
            productTierType: organization?.productTierType,
          },
        });
        const result = await lastValueFrom(dialogRef.closed);
        if (result === TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED) {
          this.refreshFreeTrialWarningTrigger.next();
        }
      }),
    );

  private readThroughWarnings$ = (
    organization: Organization,
    bypassCache: boolean = false,
  ): Observable<OrganizationWarningsResponse> => {
    const organizationId = organization.id as OrganizationId;
    const existing = this.cache$.get(organizationId);
    if (existing && !bypassCache) {
      return existing;
    }
    const response$ = from(this.organizationBillingClient.getWarnings(organizationId));
    this.cache$.set(organizationId, response$);
    return response$;
  };

  private getWarning$ = <T>(
    organization: Organization,
    extract: (response: OrganizationWarningsResponse) => T | null | undefined,
    bypassCache: boolean = false,
  ): Observable<T | null> =>
    this.readThroughWarnings$(organization, bypassCache).pipe(
      map((response) => {
        const value = extract(response);
        return value ? value : null;
      }),
      take(1),
    );
}
