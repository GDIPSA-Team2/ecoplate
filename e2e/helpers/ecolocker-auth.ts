import { WebDriver } from 'selenium-webdriver';
import { EcoLockerLoginPage } from '../pages/ecolocker';
import { testUsers } from '../fixtures/users';
import { config } from '../selenium.config';

export async function loginToEcoLocker(driver: WebDriver, userType: 'primary' | 'secondary' = 'primary'): Promise<void> {
  const loginPage = new EcoLockerLoginPage(driver);
  const user = testUsers[userType];

  await loginPage.goto();
  await loginPage.login(user.email, user.password);
  await loginPage.waitForUrlToNotContain('/login');
}

export async function ensureEcoLockerLoggedOut(driver: WebDriver): Promise<void> {
  await driver.get(`${config.baseUrl}/ecolocker/login`);
  // Clear local storage to remove any auth tokens
  await driver.executeScript('localStorage.clear()');
}

export async function isEcoLockerLoggedIn(driver: WebDriver): Promise<boolean> {
  const token = await driver.executeScript('return localStorage.getItem("ecolocker_token")') as string | null;
  return token !== null;
}
