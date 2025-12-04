# FMCSA Clearinghouse Automation

This project automates the process of uploading driver data to the FMCSA Clearinghouse portal. It's designed to save you time by handling the login, navigation, and file upload steps automatically.

We use **Playwright** to drive the browser interactions, and the system is wrapped in a simple API so you can easily integrate it into your workflows.

## Features

- **Automated Login**: Handles the login process for `xxxx@xxx.com`.
- **Smart 2FA**: Automatically generates and enters TOTP codes (with a manual fallback just in case).
- **File Upload**: Navigates to the Bulk Query page, selects the correct employer, and uploads your driver data.
- **API Interface**: Send JSON data directly to the service, and it handles the conversion to TSV and upload.
- **Dockerized**: Runs in a container with video recording enabled for easy verification.

---

## Quick Start (Docker) 🐳

The easiest way to run this is using Docker. This ensures you have all the necessary browser dependencies without cluttering your local machine.

### 1. Start the Service
Run the following command to build and start the container:

```bash
docker-compose up --build
```

The service will start and listen on port **3100**.

### 2. Upload Drivers via API
Once the server is running, you can trigger the automation by sending a POST request.

**Security:**
You must provide an `x-api-key` header that matches the `API_KEY` environment variable set in your `.env` file or Docker environment.

**Endpoint:** `POST http://localhost:3100/upload-drivers/{company_uuid}`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <YOUR_API_KEY>`

**Example Payload:**
```json
[
  {
    "LastName": "Doe",
    "FirstName": "John",
    "DOB": "01/01/1980",
    "CDL": "123456789",
    "Country": "US",
    "State": "NY",
    "QueryType": "1"
  }
]
```

**Curl Example:**
```bash
curl -X POST http://localhost:3100/upload-drivers/{company_uuid} \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_API_KEY>" \
  -d '[{"LastName": "Doe", "FirstName": "John", "DOB": "01/01/1980", "CDL": "123456789", "Country": "US", "State": "NY", "QueryType": "1"}]'
```

### 3. View Session Recordings
When running in Docker, the script records a video of the entire browser session. You can find these recordings in the `videos/` directory. This is great for debugging or just verifying that everything went smoothly.

---

## Local Development

If you prefer to run the script locally (e.g., to watch the browser in real-time):

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Script**:
    ```bash
    npm start
    ```
    *Note: This runs the standalone script using `data/sample.tsv`.*

3.  **Run the API Server**:
    ```bash
    npx ts-node src/server.ts
    ```

---

## Project Structure

- `src/main.ts`: The core automation logic (Playwright script).
- `src/server.ts`: The Express API server that handles requests.
- `data/`: Directory for storing generated TSV files and samples.
- `videos/`: Directory where session recordings are saved (Docker only).

Feel free to explore the code—I've added detailed comments to explain how the automation works under the hood.

Happy automating! 🚀