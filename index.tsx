/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

interface NutritionInfo {
    [key: string]: string; // e.g., "Calories": "Approx. 500 kcal"
}

interface Ingredient {
    name: string;
    amount: string;
}

interface FusionDishData {
    fusionDishName: string;
    description: string;
    ingredients: Ingredient[];
    recipeSteps: string[];
    funFact: string; // Fun fact about the original Western dish
    nutritionInfo?: NutritionInfo; // Optional nutrition information
}

// Element References
const dishInputElement = document.getElementById('dish-input') as HTMLInputElement;
const fuseButtonElement = document.getElementById('fuse-button') as HTMLButtonElement;
const loadingIndicatorElement = document.getElementById('loading-indicator') as HTMLDivElement;
const loadingTextElement = document.getElementById('loading-text') as HTMLParagraphElement;
const errorMessageElement = document.getElementById('error-message') as HTMLDivElement;
const outputContainerElement = document.getElementById('output-container') as HTMLDivElement;

// Original Dish Card Elements
const originalDishNameElement = document.getElementById('original-dish-name') as HTMLParagraphElement;
const originalDishFunFactElement = document.getElementById('original-dish-fun-fact') as HTMLParagraphElement;

// Fusion Card Elements
const fusionDishTitleElement = document.getElementById('fusion-dish-title') as HTMLHeadingElement;
const fusionDishImageElement = document.getElementById('fusion-dish-image') as HTMLImageElement;
const fusionDishDescriptionElement = document.getElementById('fusion-dish-description') as HTMLParagraphElement;
const fusionDishIngredientsHeadingElement = document.getElementById('fusion-dish-ingredients-heading') as HTMLHeadingElement;
const fusionDishIngredientsListElement = document.getElementById('fusion-dish-ingredients-list') as HTMLUListElement;
const fusionDishRecipeHeadingElement = document.getElementById('fusion-dish-recipe-heading') as HTMLHeadingElement;
const fusionDishRecipeElement = document.getElementById('fusion-dish-recipe') as HTMLDivElement;

// Nutrition Info Elements
const fusionDishNutritionContainerElement = document.getElementById('fusion-dish-nutrition-container') as HTMLDivElement;
const fusionDishNutritionTableBodyElement = document.getElementById('nutrition-table-body') as HTMLTableSectionElement;


let ai: GoogleGenAI;

if (!API_KEY) {
    console.error("API_KEY is not set. Please set the process.env.API_KEY environment variable.");
    displayCriticalError('Configuration error: API Key is missing. The application cannot function.');
} else {
    ai = new GoogleGenAI({ apiKey: API_KEY });
    if (fuseButtonElement) {
        fuseButtonElement.addEventListener('click', handleFuseDish);
    }
    if (dishInputElement) {
        dishInputElement.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleFuseDish();
            }
        });
    }
}

function displayCriticalError(message: string) {
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
    }
    if (fuseButtonElement) {
        fuseButtonElement.disabled = true;
        fuseButtonElement.textContent = 'Service Unavailable';
    }
    const inputSection = document.querySelector('.input-section') as HTMLElement;
    if (inputSection) inputSection.style.display = 'none';
}


async function getFusionIdea(dishName: string, dishDescription: string): Promise<FusionDishData> {
    let prompt = `You are an expert chef specializing in innovative Indian fusion cuisine.
Given the Western dish: "${dishName}"`;

    if (dishDescription) {
        prompt += `\nDescription of the dish: "${dishDescription}"`;
    }

    prompt += `

Please provide an Indian fusion version. Your response MUST be a JSON object with the following structure:
{
  "fusionDishName": "string (Creative and appealing name for the fusion dish)",
  "description": "string (A brief, enticing description, 2-3 sentences, highlighting key Indian elements and their blend with the Western dish)",
  "ingredients": [ 
    { "name": "string (Ingredient name)", "amount": "string (Quantity, e.g., '1 cup', '200g')" }
    // ... more ingredients
  ],
  "recipeSteps": ["string", "string", "... (An array of strings, where each string is a step in the recipe/preparation for the fusion dish)"],
  "funFact": "string (A short, interesting fun fact about the ORIGINAL Western dish: ${dishName})",
  "nutritionInfo": {
    "Calories": "string (e.g., 'Approx. 550 kcal per serving')",
    "Protein": "string (e.g., 'Approx. 25g')",
    "Carbohydrates": "string (e.g., 'Approx. 60g')",
    "Fat": "string (e.g., 'Approx. 20g')",
    "Fiber": "string (e.g., 'Approx. 5g (optional)')",
    "Sodium": "string (e.g., 'Approx. 600mg (optional)')"
  }
}

Ensure the JSON is well-formed. Provide values for nutritionInfo where appropriate, but it's okay if some nutrients are not applicable or estimable. The ingredients array should detail what's needed for the fusion dish. The funFact should be about the original dish submitted.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    try {
        const parsedData = JSON.parse(jsonStr) as FusionDishData;
        if (!parsedData.fusionDishName || !parsedData.description || 
            !Array.isArray(parsedData.recipeSteps) || !Array.isArray(parsedData.ingredients) ||
            !parsedData.funFact) {
            console.error("Invalid JSON structure received from API (missing core fields). Received:", parsedData);
            throw new Error("Invalid JSON structure received from API (missing core fields: name, description, ingredients, recipe, or funFact).");
        }
        // Validate ingredients structure
        if (parsedData.ingredients.some(ing => typeof ing.name !== 'string' || typeof ing.amount !== 'string')) {
            console.error("Invalid ingredients structure. Received:", parsedData.ingredients);
            throw new Error("Invalid ingredients structure in API response.");
        }

        if (parsedData.nutritionInfo && typeof parsedData.nutritionInfo !== 'object') {
            console.warn("Received nutritionInfo but it was not an object. Ignoring.");
            delete parsedData.nutritionInfo;
        }
        return parsedData;
    } catch (e) {
        console.error("Failed to parse JSON response:", e, "\nReceived text:", response.text);
        throw new Error("Failed to parse fusion suggestion from the AI. The format was unexpected.");
    }
}

async function generateFusionImage(dishName: string, description: string): Promise<string> {
    const imagePrompt = `A delicious, appetizing, high-quality photograph of "${dishName}". ${description}. Food photography, vibrant colors, detailed.`;
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: imagePrompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("No image data received from API.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate an image for the fusion dish.");
    }
}


async function handleFuseDish() {
    if (!dishInputElement) return;
    const dishName = dishInputElement.value.trim();
    const dishDescription = ""; 

    if (!dishName) {
        displayError("Please enter a Western dish name.");
        return;
    }
     if (!API_KEY || !ai) {
        displayCriticalError("API Key is not configured. Cannot fetch suggestions.");
        return;
    }

    showLoading(true, "Crafting your DesiBytes masterpiece...");
    clearPreviousResults();
    let fusionData: FusionDishData | null = null;

    try {
        fusionData = await getFusionIdea(dishName, dishDescription);

        showLoading(true, `"${fusionData.fusionDishName}" sounds delicious! Now, generating an image...`);
        try {
            const imageUrl = await generateFusionImage(fusionData.fusionDishName, fusionData.description);
            displayResults(dishName, fusionData, imageUrl);
        } catch (imageError) {
            console.warn("Image generation failed, displaying text results only:", imageError);
            displayResults(dishName, fusionData, null, (imageError as Error).message || "Could not load image.");
        }

    } catch (error) {
        console.error("Error in fusion process:", error);
        let message = "Failed to generate suggestion. Please try again.";
        if (error instanceof Error) {
             message = `An error occurred: ${error.message}.`;
        }
        displayError(message);
    } finally {
        showLoading(false);
    }
}

function showLoading(isLoading: boolean, text: string = "Whipping up a fusion idea...") {
    if (!loadingIndicatorElement || !loadingTextElement || !fuseButtonElement) return;

    if (isLoading) {
        loadingIndicatorElement.style.display = 'flex';
        loadingTextElement.textContent = text;
        fuseButtonElement.disabled = true;
        fuseButtonElement.setAttribute('aria-busy', 'true');
    } else {
        loadingIndicatorElement.style.display = 'none';
        fuseButtonElement.disabled = false;
        fuseButtonElement.removeAttribute('aria-busy');
    }
}

function clearPreviousResults() {
    if (!errorMessageElement || !outputContainerElement || !originalDishNameElement ||
        !originalDishFunFactElement || !fusionDishTitleElement || !fusionDishImageElement || 
        !fusionDishDescriptionElement || !fusionDishIngredientsHeadingElement ||
        !fusionDishIngredientsListElement || !fusionDishRecipeElement || 
        !fusionDishRecipeHeadingElement || !fusionDishNutritionContainerElement || 
        !fusionDishNutritionTableBodyElement) return;

    errorMessageElement.style.display = 'none';
    errorMessageElement.textContent = '';
    outputContainerElement.style.display = 'none';

    originalDishNameElement.textContent = '';
    originalDishFunFactElement.textContent = '';
    originalDishFunFactElement.style.display = 'none';

    fusionDishTitleElement.textContent = 'DesiFusion Suggestion';
    fusionDishImageElement.src = '#';
    fusionDishImageElement.alt = 'Generated fusion dish image';
    fusionDishImageElement.style.display = 'none';
    fusionDishDescriptionElement.textContent = '';

    fusionDishIngredientsHeadingElement.style.display = 'none';
    fusionDishIngredientsListElement.innerHTML = '';

    fusionDishRecipeElement.innerHTML = '';
    fusionDishRecipeHeadingElement.style.display = 'none';

    fusionDishNutritionContainerElement.style.display = 'none';
    fusionDishNutritionTableBodyElement.innerHTML = '';
}

function displayError(message: string) {
    if (!errorMessageElement || !outputContainerElement) return;
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = 'block';
    outputContainerElement.style.display = 'none';
}

function displayResults(
    originalDish: string,
    fusionData: FusionDishData,
    imageUrl: string | null,
    imageError?: string
) {
    if (!outputContainerElement || !originalDishNameElement || !originalDishFunFactElement ||
        !fusionDishTitleElement || !fusionDishImageElement || !fusionDishDescriptionElement ||
        !fusionDishIngredientsHeadingElement || !fusionDishIngredientsListElement ||
        !fusionDishRecipeElement || !fusionDishRecipeHeadingElement || !errorMessageElement ||
        !fusionDishNutritionContainerElement || !fusionDishNutritionTableBodyElement ) return;

    originalDishNameElement.textContent = originalDish;
    if (fusionData.funFact) {
        originalDishFunFactElement.textContent = `Fun Fact: ${fusionData.funFact}`;
        originalDishFunFactElement.style.display = 'block';
    } else {
        originalDishFunFactElement.style.display = 'none';
    }

    fusionDishTitleElement.textContent = fusionData.fusionDishName;
    fusionDishDescriptionElement.textContent = fusionData.description;

    if (imageUrl) {
        fusionDishImageElement.src = imageUrl;
        fusionDishImageElement.alt = `Image of ${fusionData.fusionDishName}`;
        fusionDishImageElement.style.display = 'block';
    } else {
        fusionDishImageElement.style.display = 'block'; // Show placeholder
        fusionDishImageElement.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10px" fill="%23ccc">No Image</text></svg>';
        fusionDishImageElement.alt = imageError || "Image not available";
    }

    // Display Ingredients
    fusionDishIngredientsListElement.innerHTML = '';
    if (fusionData.ingredients && fusionData.ingredients.length > 0) {
        fusionDishIngredientsHeadingElement.style.display = 'block';
        fusionData.ingredients.forEach(ingredient => {
            const li = document.createElement('li');
            li.textContent = `${ingredient.amount} ${ingredient.name}`;
            fusionDishIngredientsListElement.appendChild(li);
        });
    } else {
        fusionDishIngredientsHeadingElement.style.display = 'none';
    }

    // Display Recipe Steps
    fusionDishRecipeElement.innerHTML = ''; 
    if (fusionData.recipeSteps && fusionData.recipeSteps.length > 0) {
        fusionDishRecipeHeadingElement.style.display = 'block';
        const ol = document.createElement('ol');
        fusionData.recipeSteps.forEach(step => {
            const li = document.createElement('li');
            li.textContent = step;
            ol.appendChild(li);
        });
        fusionDishRecipeElement.appendChild(ol);
    } else {
        fusionDishRecipeHeadingElement.style.display = 'none';
    }

    // Display Nutrition Information
    fusionDishNutritionTableBodyElement.innerHTML = ''; 
    if (fusionData.nutritionInfo && Object.keys(fusionData.nutritionInfo).length > 0) {
        let hasNutritionData = false;
        for (const nutrient in fusionData.nutritionInfo) {
            if (Object.prototype.hasOwnProperty.call(fusionData.nutritionInfo, nutrient) && fusionData.nutritionInfo[nutrient]) {
                const tr = document.createElement('tr');
                const nutrientCell = document.createElement('td');
                nutrientCell.textContent = nutrient;
                const valueCell = document.createElement('td');
                valueCell.textContent = fusionData.nutritionInfo[nutrient];
                tr.appendChild(nutrientCell);
                tr.appendChild(valueCell);
                fusionDishNutritionTableBodyElement.appendChild(tr);
                hasNutritionData = true;
            }
        }
        if (hasNutritionData) {
            fusionDishNutritionContainerElement.style.display = 'block';
        } else {
            fusionDishNutritionContainerElement.style.display = 'none';
        }
    } else {
        fusionDishNutritionContainerElement.style.display = 'none';
    }


    outputContainerElement.style.display = 'block';
    errorMessageElement.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    if (!API_KEY) {
       if (fuseButtonElement && !fuseButtonElement.disabled) {
           displayCriticalError('Critical Error: API Key not found. The application cannot function.');
       }
    }
    if (dishInputElement) {
        dishInputElement.focus();
    }
});