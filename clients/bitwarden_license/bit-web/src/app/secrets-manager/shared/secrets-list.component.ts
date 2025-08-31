// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { catchError, concatMap, map, Observable, of, Subject, switchMap, takeUntil } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService, TableDataSource, ToastService } from "@bitwarden/components";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretView } from "../models/view/secret.view";
import { SecretService } from "../secrets/secret.service";

@Component({
  selector: "sm-secrets-list",
  templateUrl: "./secrets-list.component.html",
  standalone: false,
})
export class SecretsListComponent implements OnDestroy, OnInit {
  protected dataSource = new TableDataSource<SecretListView>();

  @Input()
  get secrets(): SecretListView[] {
    return this._secrets;
  }
  set secrets(secrets: SecretListView[]) {
    this.selection.clear();
    this._secrets = secrets;
    this.dataSource.data = secrets;
  }
  private _secrets: SecretListView[];

  @Input()
  set search(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  @Input() trash: boolean;

  @Output() editSecretEvent = new EventEmitter<string>();
  @Output() viewSecretEvent = new EventEmitter<string>();
  @Output() copySecretNameEvent = new EventEmitter<string>();
  @Output() copySecretValueEvent = new EventEmitter<string>();
  @Output() copySecretUuidEvent = new EventEmitter<string>();
  @Output() onSecretCheckedEvent = new EventEmitter<string[]>();
  @Output() deleteSecretsEvent = new EventEmitter<SecretListView[]>();
  @Output() newSecretEvent = new EventEmitter();
  @Output() restoreSecretsEvent = new EventEmitter();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);
  protected viewEventsAllowed$: Observable<boolean>;
  protected isAdmin$: Observable<boolean>;

  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onSecretCheckedEvent.emit(this.selection.selected));
  }

  ngOnInit(): void {
    this.viewEventsAllowed$ = this.activatedRoute.params.pipe(
      concatMap((params) =>
        getUserId(this.accountService.activeAccount$).pipe(
          switchMap((userId) =>
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
      map((org) => org.canAccessEventLogs),
      catchError((error: unknown) => {
        if (typeof error === "string") {
          this.toastService.showToast({
            message: error,
            variant: "error",
            title: "",
          });
        } else {
          this.logService.error(error);
        }
        return of(false);
      }),
      takeUntil(this.destroy$),
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAllSelected() {
    if (this.selection.selected?.length > 0) {
      const numSelected = this.selection.selected.length;
      const numRows = this.dataSource.filteredData.length;
      return numSelected === numRows;
    }
    return false;
  }
  openEventsDialog = (secret: SecretView): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: secret.name,
        organizationId: secret.organizationId,
        entityId: secret.id,
        entity: "secret",
      },
    });

  toggleAll() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.filteredData.map((s) => s.id));
    }
  }

  bulkDeleteSecrets() {
    if (this.selection.selected.length >= 1) {
      this.deleteSecretsEvent.emit(
        this.secrets.filter((secret) => this.selection.isSelected(secret.id)),
      );
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  bulkRestoreSecrets() {
    if (this.selection.selected.length >= 1) {
      this.restoreSecretsEvent.emit(this.selection.selected);
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  sortProjects = (a: SecretListView, b: SecretListView): number => {
    const aProjects = a.projects;
    const bProjects = b.projects;
    if (aProjects.length !== bProjects.length) {
      return aProjects.length - bProjects.length;
    }

    return aProjects[0]?.name.localeCompare(bProjects[0].name);
  };

  protected editSecret(secret: SecretListView) {
    if (secret.write) {
      this.editSecretEvent.emit(secret.id);
    } else {
      this.viewSecretEvent.emit(secret.id);
    }
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static copySecretName(
    name: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(name);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("name")),
    );
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static async copySecretValue(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    secretService: SecretService,
    logService: LogService,
  ) {
    try {
      const value = await secretService.getBySecretId(id).then((secret) => secret.value);
      platformUtilsService.copyToClipboard(value);
      platformUtilsService.showToast(
        "success",
        null,
        i18nService.t("valueCopied", i18nService.t("value")),
      );
    } catch {
      logService.info("Error fetching secret value.");
    }
  }

  static copySecretUuid(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(id);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("uuid")),
    );
  }
}
