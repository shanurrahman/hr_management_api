import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import { CompletionServiceSelector } from 'llms-client';
import * as extract from 'pdf-text-extract';
import { promisify } from 'util';

@Injectable()
export class CompletionService {
  async getFileText(file: Express.Multer.File) {
    const data = new FormData();
    data.append('file', fs.createReadStream(file.path));

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://40.114.35.115:4000/convert/format/txt/output/sample.txt',
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };

    const result = await axios.request(config);
    return result.data;
  }

  async getPdfText(file: Express.Multer.File) {
    const extractPromise = promisify(extract);
    try {
      const textArray = await extractPromise(file.path, { splitPages: false });
      const text = textArray.join(' ');
      return text.replace(/[^\w\s.,/\\-]|_/g, '');
    } catch (err) {
      console.error(err);
    }
  }

  completion = new CompletionServiceSelector({
    apiKey: process.env.openaiKey,
    baseurl: 'https://api.openai.com',
    type: 'chatGPT',
    model: 'gpt-3.5-turbo',
    timeout: 40 * 1000,
  });

  async completeResponse(text: string) {
    return this.completion.getChatCompletions(
      [
        { content: text, role: 'assistant' },
        { role: 'assistant', content: '' },
      ],
      1000,
    );
  }

  async parseResume(resume: string) {
    const pre = 'Here is a sample resume in text form:';

    const post = `Please parse this resume and return the information in the following JSON format:
    {
      "name": "<name from resume>",
      "email": "<email from resume>", 
      "phone": "<phone number from resume>",
      "linkedin": "<linkedin profile url>",
      "github": "<github profile url>",
      "website": "<personal website url>",
      "position": "<most recent position from experience section>",
      "company": "<most recent company from experience section>",
      "experience": [
        {
          "role": "<role>",
          "company": "<company>",
          "start_date": "<start date>",
          "end_date": "<end date>",
          "location": "<location>",
          "description": "<experience description>"
        }
      ],
      "degree": "<highest degree from education section>",
      "university": "<university from education section>",
      "education": [
        {
          "degree": "<degree>",
          "university": "<university>",
          "start_date": "<start date>",
          "end_date": "<end date>",
          "gpa": "<gpa>"
        }
      ],
      "skills": ["<list of skills>"],
      "languages": ["<list of languages>"],
      "interests": ["<list of interests>"],
      "awards": [
        {
          "title": "<award title>",
          "organization": "<organization>",
          "date": "<date received>"
        }
      ],
      "publications": [
        {
          "title": "<publication title>",
          "publisher": "<publisher>",
          "date": "<date published>"
        }
      ],
      "certifications": [
        {
          "title": "<certification title>",
          "organization": "<organization>",
          "date": "<date completed>"
        }
      ] 
    }
    `;

    const prompt = `${pre}${resume}${post}`;

    return this.completeResponse(prompt);
  }
}
