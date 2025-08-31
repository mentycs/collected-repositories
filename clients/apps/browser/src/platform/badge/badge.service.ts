import { concatMap, filter, Subscription, withLatestFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BADGE_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BadgeBrowserApi, RawBadgeState } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";

interface StateSetting {
  priority: BadgeStatePriority;
  state: BadgeState;
  tabId?: number;
}

const BADGE_STATES = new KeyDefinition(BADGE_MEMORY, "badgeStates", {
  deserializer: (value: Record<string, StateSetting>) => value ?? {},
});

export class BadgeService {
  private serviceState: GlobalState<Record<string, StateSetting>>;

  constructor(
    private stateProvider: StateProvider,
    private badgeApi: BadgeBrowserApi,
    private logService: LogService,
  ) {
    this.serviceState = this.stateProvider.getGlobal(BADGE_STATES);
  }

  /**
   * Start listening for badge state changes.
   * Without this the service will not be able to update the badge state.
   */
  startListening(): Subscription {
    // React to tab changes
    return this.badgeApi.activeTab$
      .pipe(
        withLatestFrom(this.serviceState.state$),
        filter(([activeTab]) => activeTab != undefined),
        concatMap(async ([activeTab, serviceState]) => {
          await this.updateBadge(serviceState, activeTab!.tabId);
        }),
      )
      .subscribe({
        error: (error: unknown) => {
          this.logService.error(
            "Fatal error in badge service observable, badge will fail to update",
            error,
          );
        },
      });
  }

  /**
   * Inform badge service of a new state that the badge should reflect.
   *
   * This will merge the new state with any existing states:
   * - If the new state has a higher priority, it will override any lower priority states.
   * - If the new state has a lower priority, it will be ignored.
   * - If the name of the state is already in use, it will be updated.
   * - If the state has a `tabId` set, it will only apply to that tab.
   *   - States with `tabId` can still be overridden by states without `tabId` if they have a higher priority.
   *
   * @param name The name of the state. This is used to identify the state and will be used to clear it later.
   * @param priority The priority of the state (higher numbers are higher priority, but setting arbitrary numbers is not supported).
   * @param state The state to set.
   * @param tabId Limit this badge state to a specific tab. If this is not set, the state will be applied to all tabs.
   */
  async setState(name: string, priority: BadgeStatePriority, state: BadgeState, tabId?: number) {
    const newServiceState = await this.serviceState.update((s) => ({
      ...s,
      [name]: { priority, state, tabId },
    }));

    await this.updateBadge(newServiceState, tabId);
  }

  /**
   * Clear the state with the given name.
   *
   * This will remove the state from the badge service and clear it from the badge.
   * If the state is not found, nothing will happen.
   *
   * @param name The name of the state to clear.
   */
  async clearState(name: string) {
    let clearedState: StateSetting | undefined;

    const newServiceState = await this.serviceState.update((s) => {
      clearedState = s?.[name];

      const newStates = { ...s };
      delete newStates[name];
      return newStates;
    });

    if (clearedState === undefined) {
      return;
    }
    // const activeTabs = await firstValueFrom(this.badgeApi.activeTabs$);
    await this.updateBadge(newServiceState, clearedState.tabId);
  }

  private calculateState(states: Set<StateSetting>, tabId?: number): RawBadgeState {
    const sortedStates = [...states].sort((a, b) => a.priority - b.priority);

    let filteredStates = sortedStates;
    if (tabId !== undefined) {
      // Filter out states that are not applicable to the current tab.
      // If a state has no tabId, it is considered applicable to all tabs.
      // If a state has a tabId, it is only applicable to that tab.
      filteredStates = sortedStates.filter((s) => s.tabId === tabId || s.tabId === undefined);
    } else {
      // If no tabId is provided, we only want states that are not tab-specific.
      filteredStates = sortedStates.filter((s) => s.tabId === undefined);
    }

    const mergedState = filteredStates
      .map((s) => s.state)
      .reduce<Partial<RawBadgeState>>((acc: Partial<RawBadgeState>, state: BadgeState) => {
        const newState = { ...acc };

        for (const k in state) {
          const key = k as keyof BadgeState & keyof RawBadgeState;
          setStateValue(newState, state, key);
        }

        return newState;
      }, DefaultBadgeState);

    return {
      ...DefaultBadgeState,
      ...mergedState,
    };
  }

  /**
   * Common function deduplicating the logic for updating the badge with the current state.
   * This will only update the badge if the active tab is the same as the tabId of the latest change.
   * If the active tab is not set, it will not update the badge.
   *
   * @param activeTab The currently active tab.
   * @param serviceState The current state of the badge service. If this is null or undefined, an empty set will be assumed.
   * @param tabId Tab id for which the the latest state change applied to. Set this to activeTab.tabId to force an update.
   */
  private async updateBadge(
    // activeTabs: chrome.tabs.Tab[],
    serviceState: Record<string, StateSetting> | null | undefined,
    tabId: number | undefined,
  ) {
    const activeTabs = await this.badgeApi.getActiveTabs();
    if (tabId !== undefined && !activeTabs.some((tab) => tab.id === tabId)) {
      return; // No need to update the badge if the state is not for the active tab.
    }

    const tabIdsToUpdate = tabId ? [tabId] : activeTabs.map((tab) => tab.id);

    for (const tabId of tabIdsToUpdate) {
      if (tabId === undefined) {
        continue; // Skip if tab id is undefined.
      }

      const newBadgeState = this.calculateState(new Set(Object.values(serviceState ?? {})), tabId);
      try {
        await this.badgeApi.setState(newBadgeState, tabId);
      } catch (error) {
        this.logService.error("Failed to set badge state", error);
      }
    }

    if (tabId === undefined) {
      // If no tabId was provided we should also update the general badge state
      const newBadgeState = this.calculateState(new Set(Object.values(serviceState ?? {})));

      try {
        await this.badgeApi.setState(newBadgeState, tabId);
      } catch (error) {
        this.logService.error("Failed to set general badge state", error);
      }
    }
  }
}

/**
 * Helper value to modify the state variable.
 * TS doesn't like it when this is being doine inline.
 */
function setStateValue<Key extends keyof BadgeState & keyof RawBadgeState>(
  newState: Partial<RawBadgeState>,
  state: BadgeState,
  key: Key,
) {
  if (state[key] === Unset) {
    delete newState[key];
  } else if (state[key] !== undefined) {
    newState[key] = state[key] as RawBadgeState[Key];
  }
}
