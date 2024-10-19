const express = require('express');
const cors = require('cors');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.OPEN_API_KEY });



app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase the limit to handle large PDF contents

// Define your API routes here
app.get('/api/example', (req, res) => {
  res.json({ message: 'This is an example API route' });
});

app.get('/api/config', (req, res) => {
    res.json({ apiKey: process.env.OPEN_API_KEY });
})

// New route to handle question submissions
app.post('/api/submit-question', async (req, res) => {
    const { question, topic, detailLevel, modelSettings, pdfContents } = req.body;
    
    // Extract text from PDF contents
    const pdfTexts = await Promise.all(pdfContents.map(async (pdfContent) => {
        try {
            const data = await pdfParse(Buffer.from(pdfContent));
            return data.text;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            return ''; // Return empty string if PDF parsing fails
        }
    }));
    
    const pdfText = pdfTexts.join('\n\n');
    console.log(pdfText);
    
    const prompt = `Use the following PDF contents as context for answering the question:

${pdfText}

Now, explain the concept of ${question} within the field of ${topic} in a ${detailLevel} manner. Structure your response to be appropriate for a university-level audience, with clear explanations that balance depth and accessibility. Your explanation should:

Provide a precise definition using discipline-specific terminology and definitions.
Include 2-3 examples or analogies that clarify key ideas and showcase real-world relevance.
Highlight important distinctions or common misconceptions students should be aware of.
Conclude with a summary that integrates and reinforces the main points.
Use Markdown syntax:

Use # for the main title (the question or concept)
Use ## for major sections like "Definition," "Examples," and "Summary"
Use bullet points (- ) for lists
Highlight key terms using bold
Use > for key takeaways or important clarifications
For mathematical formulas, use LaTeX syntax:
- For inline formulas, use single dollar signs: $formula$
- For block formulas, use double dollar signs: $$formula$$
Ensure all mathematical symbols, variables, and equations are properly formatted in LaTeX.
Aim for clarity while maintaining intellectual rigor and avoid oversimplification.`;
    
    try {
        // Default settings in case modelSettings is undefined
        const defaultSettings = {
            temperature: 0.7,
            tokens: {
                short: 200,
                medium: 1024,
                detailed: 2048
            }
        };

        // Use modelSettings if provided, otherwise use default settings
        const settings = modelSettings || defaultSettings;
        
        let max_tokens = settings.tokens[detailLevel];

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a knowledgeable and patient teacher, skilled at explaining complex concepts in simple terms. Your goal is to help learners understand new ideas clearly and easily."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: settings.temperature,
            max_tokens: max_tokens,
            top_p: 0.9,
            stream: true,
            stop: null
        });

        let fullResponse = '';
        for await (const chunk of completion) {
            fullResponse += chunk.choices[0]?.delta?.content || '';
        }

        res.json({ message: fullResponse });
    //   res.json({ message: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error('OpenAI API error:', error);
      res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  });


app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
