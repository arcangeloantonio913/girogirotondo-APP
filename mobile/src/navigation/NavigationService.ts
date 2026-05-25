import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  }
}

export function navigateToTab(tabsName: string, screen: string) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.navigate({ name: tabsName, params: { screen } })
    );
  }
}
