import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import { authenticator } from 'otplib';

/**
 * Main function to execute the FMCSA Clearinghouse automation.
 * This script logs in, handles potential 2FA (by waiting for user input),
 * navigates to the bulk upload page, selects an employer, and uploads a file.
 * 
 * @param dataFilePath - Optional path to the TSV file to upload. Defaults to '../data/sample.tsv'.
 * @param companyUUID - Optional UUID of the company to select.
 */
export async function run(dataFilePath?: string, companyUUID?: string) {
    console.log('Starting FMCSA Clearinghouse Automation...');

    // Launch the browser
    // Check environment variables for headless mode (default to false for local dev, true for Docker)
    const isHeadless = process.env.HEADLESS === 'true';

    const browser: Browser = await chromium.launch({
        headless: isHeadless,
        slowMo: 100,
    });

    // Configure video recording if enabled
    const recordVideoDir = process.env.RECORD_VIDEO === 'true' ? 'videos/' : undefined;

    const context = await browser.newContext({
        recordVideo: recordVideoDir ? { dir: recordVideoDir, size: { width: 1280, height: 720 } } : undefined
    });

    const page: Page = await context.newPage();

    try {
        // 1. Navigate to the login page
        console.log('Navigating to login page...');
        await page.goto('https://secure.login.gov/');

        // 2. Perform Login
        // Note: The login page might redirect to login.gov. 
        // We need to handle the specific login flow.
        // Based on the user request, we have credentials.
        // However, FMCSA usually uses Login.gov which has a specific flow.
        // We will attempt to fill standard fields if present, or wait for the user to log in.

        console.log('Please log in manually if the script does not handle the specific login portal.');
        console.log('Using provided credentials...');

        // Attempt to fill email if the field is present and visible
        try {
            // These selectors are best guesses based on standard login forms. 
            // Real selectors might differ (e.g., #user_email, name="email").
            // We will try to find a generic email input.
            const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"]');
            if (await emailInput.count() > 0 && await emailInput.first().isVisible()) {
                await emailInput.first().fill(process.env.FMCSA_EMAIL || '');
                console.log('Filled email.');
            }

            // Attempt to fill password
            const passwordInput = page.locator('input[type="password"]');
            if (await passwordInput.count() > 0 && await passwordInput.first().isVisible()) {
                await passwordInput.first().fill(process.env.FMCSA_PASSWORD || '');
                console.log('Filled password.');
            }

            // Attempt to click a login button
            const loginButton = page.locator('button[type="submit"], input[type="submit"]');
            // if (await loginButton.count() > 0 && await loginButton.first().isVisible()) {
            await loginButton.first().click(); // Uncomment to auto-click, but might be safer to let user review
            // console.log('Ready to click login. If auto-click is disabled, please click manually.');
            // }

        } catch (e) {
            console.log('Could not auto-fill login form. Please fill manually.');
        }

        // 3. Wait for successful login
        // We assume login is successful when we are redirected to the dashboard or the URL changes.
        // Or we can just wait for the user to navigate to the dashboard.
        // 3. Handle 2FA (Automated or Manual)
        console.log('Checking for 2FA...');

        // Define your TOTP secret here (or load from environment variables)
        const TOTP_SECRET = process.env.TOTP_SECRET || '';
        // For now, we'll use a placeholder. PLEASE REPLACE THIS.

        // Check if we are on a 2FA page (Login.gov usually asks for code)
        // Using specific class from user provided HTML
        const otpInput = page.locator('.one-time-code-input__input, input[autocomplete="one-time-code"]');

        console.log('2FA input detected. Generating token...');

        // Generate TOTP
        const token = authenticator.generate(TOTP_SECRET);
        console.log('Token generated.');

        // Fill TOTP
        await otpInput.first().fill(token);
        console.log('Filled 2FA code.');

        // Click submit/continue
        const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
        if (await submitBtn.count() > 0) {
            await submitBtn.first().click();
            console.log('Submitted 2FA.');
        }

        // Wait for navigation
        await page.waitForLoadState('networkidle');

        // Give the page a moment to settle after login.gov saves cookies
        await page.waitForTimeout(2000);
        console.log(`Current URL after 2FA: ${page.url()}`);

        // Check for "Continue" button on https://secure.login.gov/user_authorization_confirmation
        // We use a more loose check or wait for the URL
        if (page.url().includes('user_authorization_confirmation')) {
            console.log('Detected "Continue" page. Waiting for button...');
            const continueBtn = page.locator('button.usa-button--big.usa-button--wide, button:has-text("Continue")');
            try {
                await continueBtn.first().waitFor({ state: 'visible', timeout: 5000 });
                await continueBtn.first().click();
                await page.waitForLoadState('networkidle');
                console.log('Clicked Continue.');
            } catch (e) {
                console.log('Continue button not found or not clickable, moving on...');
            }
        } else {
            // Fallback: check if the button is visible anyway
            const continueBtn = page.locator('button:has-text("Continue")');
            if (await continueBtn.count() > 0 && await continueBtn.first().isVisible()) {
                console.log('Found "Continue" button (fallback). Clicking...');
                await continueBtn.first().click();
                await page.waitForLoadState('networkidle');
            }
        }

        // 4. Navigate to Bulk Upload Page
        // If not already there, go to the bulk upload URL
        console.log(`Checking if navigation is needed. Current URL: ${page.url()}`);
        if (page.url() !== 'https://clearinghouse.fmcsa.dot.gov/Query/Add/Bulk') {
            console.log('Navigating to Bulk Query Upload page...');
            await page.goto('https://clearinghouse.fmcsa.dot.gov/Query/Add/Bulk');
            await page.waitForLoadState('domcontentloaded');
        }

        console.log(`URL after navigation: ${page.url()}`);

        // Check for "Continue" button AGAIN in case it intercepted the navigation
        if (page.url().includes('user_authorization_confirmation') || await page.locator('button:has-text("Continue")').isVisible()) {
            console.log('Detected "Continue" page after navigation. Clicking Continue...');
            const continueBtn = page.locator('button.usa-button--big.usa-button--wide, button:has-text("Continue")');
            if (await continueBtn.count() > 0 && await continueBtn.first().isVisible()) {
                await continueBtn.first().click();
                await page.waitForLoadState('networkidle');
                console.log('Clicked Continue (post-nav).');

                // Navigate again if we were redirected
                if (page.url() !== 'https://clearinghouse.fmcsa.dot.gov/Query/Add/Bulk') {
                    console.log('Re-navigating to Bulk Query Upload page...');
                    await page.goto('https://clearinghouse.fmcsa.dot.gov/Query/Add/Bulk');
                    await page.waitForLoadState('domcontentloaded');
                }
            }
        }

        // 5. Select Employer
        console.log('Selecting Employer...');
        console.log(`Current URL before selecting employer: ${page.url()}`);

        const employerSelect = page.locator('#EmployerId');
        await employerSelect.waitFor({ state: 'visible', timeout: 10000 });

        // Select by value
        const targetUUID = companyUUID || process.env.COMPANY_UUID; // Default if not provided

        if (!targetUUID) {
            throw new Error('Company UUID is required. Please provide it as an argument or set COMPANY_UUID in your environment variables.');
        }

        await employerSelect.selectOption(targetUUID);
        console.log('Employer selected.');

        // 6. Click Next (if there is a next button)
        // The user mentioned "click next". We need to find this button.
        // It's likely a button with text "Next" or type "submit".
        console.log('Looking for "Next" button...');
        const nextButton = page.locator('button:has-text("Next"), input[type="submit"], button[type="submit"]');
        if (await nextButton.count() > 0) {
            await nextButton.first().click();
            console.log('Clicked Next.');
        } else {
            console.log('Next button not found, checking if file upload is already visible...');
        }

        // 7. Upload File
        console.log('Uploading file...');
        // <input type="file" class="inputFile" required="" id="BulkFile" name="BulkFile">
        const fileInput = page.locator('#BulkFile');
        await fileInput.waitFor({ state: 'visible', timeout: 10000 });

        // Use the data file path if provided, otherwise use the sample file
        const filePath = dataFilePath ? path.resolve(dataFilePath) : path.join(__dirname, '../data/sample.tsv');
        await fileInput.setInputFiles(filePath);
        console.log(`File uploaded: ${filePath}`);

        console.log('Automation steps completed successfully!');

        // Wait a bit to ensure video captures the final state
        await page.waitForTimeout(3000);

    } catch (error) {
        console.error('An error occurred:', error);
        // Capture screenshot on error
        await page.screenshot({ path: 'videos/error.png', fullPage: true });
        console.log('Saved error screenshot to videos/error.png');
    } finally {
        console.log('Closing context to save video...');
        await context.close(); // This is crucial for saving the video!
        await browser.close();
    }
}

// Only run if called directly (e.g. via node/ts-node)
if (require.main === module) {
    run();
}
