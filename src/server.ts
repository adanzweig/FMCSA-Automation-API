import 'dotenv/config';
import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { run } from './main';

const app = express();
const PORT = 3100;

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware for API Key Authentication
const authenticateAPIKey = (req: Request, res: Response, next: any) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;
    // Check if API_KEY is set in the environment variables
    if (!validApiKey) {
        console.warn('API_KEY is not set in the environment variables. Authentication is disabled (NOT RECOMMENDED).');
        return next();
    }

    // Check if API_KEY is set in the request header and matches the environment variable
    if (!apiKey || apiKey !== validApiKey) {
        return res.status(403).json({ error: 'Forbidden: Invalid or missing API Key' });
    }

    next();
};

// Define the expected structure of the driver data
interface DriverData {
    LastName: string;
    FirstName: string;
    DOB: string;
    CDL: string;
    Country: string;
    State: string;
    QueryType: string;
}

/**
 * POST /upload-drivers/:company_uuid
 * Accepts a JSON array of drivers, converts to TSV, and triggers the automation.
 */
app.post('/upload-drivers/:company_uuid', authenticateAPIKey, async (req: Request, res: Response) => {
    try {
        const { company_uuid } = req.params;
        const drivers: DriverData[] = req.body;

        // Check that there are drivers sent 
        if (!Array.isArray(drivers) || drivers.length === 0) {
            return res.status(400).json({ error: 'Invalid input. Expected a non-empty array of drivers.' });
        }

        console.log(`Received request to upload ${drivers.length} drivers.`);

        // Convert JSON to TSV
        const header = 'LastName\tFirstName\tDOB\tCDL\tCountry\tState\tQueryType';
        const rows = drivers.map(d =>
            `${d.LastName}\t${d.FirstName}\t${d.DOB}\t${d.CDL}\t${d.Country}\t${d.State}\t${d.QueryType}`
        );
        const tsvContent = [header, ...rows].join('\n');

        // Save to a temporary file
        const timestamp = Date.now();
        const filePath = path.join(__dirname, `../data/upload_${timestamp}.tsv`);

        // Ensure data directory exists
        const dataDir = path.dirname(filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(filePath, tsvContent);
        console.log(`Saved TSV to ${filePath}`);

        // Trigger the automation
        // Note: This runs asynchronously. You might want to wait for it or return a job ID.
        // For this task, we'll wait for it to complete to return the result.
        await run(filePath, company_uuid);

        // Clean up the file (optional, maybe keep for debugging)
        // fs.unlinkSync(filePath);

        res.status(200).json({ message: 'Automation completed successfully', file: filePath });

    } catch (error: any) {
        console.error('Error in /upload-drivers:', error);
        res.status(500).json({ error: 'Automation failed', details: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
