
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CargoItem, Container, PlacedItem } from "../types";

// Helper service for cargo optimization advice
export const getLoadOptimizationAdvice = async (
  container: Container,
  items: CargoItem[],
  placedItems: PlacedItem[]
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "Configura GEMINI_API_KEY en .env.local para activar el asistente de IA. Mientras tanto, revisa manualmente la distribución de peso, el volumen ocupado y los límites de apilado.";
  }

  // Always use a named parameter for apiKey and direct access to process.env.API_KEY
  // Creating the instance inside the function follows best practices for dynamic environment variables
  const ai = new GoogleGenAI({ apiKey });

  // Use gemini-3-pro-preview for complex logistics and reasoning tasks
  const model = 'gemini-3-pro-preview';
  
  const prompt = `
    Container: ${container.name} (${container.length}x${container.width}x${container.height} cm, Max Weight: ${container.maxWeight}kg)
    Total Items to Load: ${items.reduce((acc, i) => acc + i.quantity, 0)}
    Current Placed Items: ${placedItems.length}
    
    Items List:
    ${items.map(i => `- ${i.name}: ${i.length}x${i.width}x${i.height}cm, ${i.weight}kg, Stackable: ${i.stackable}`).join('\n')}

    Responde en español y proporciona:
    1. Analisis critico de cubica, aire transportado y viajes potencialmente evitables, tomando como referencia que una mala planeacion puede desperdiciar hasta 24% del espacio.
    2. Consejos de distribucion de peso y centro de gravedad para reducir consumo de combustible.
    3. Tres acciones concretas para mejorar sustentabilidad logistica sin comprometer seguridad.
    4. Alertas por apilabilidad, peso o estabilidad.
    5. Puntaje de sustentabilidad (0-100), litros de diesel que se podrian evitar, compatibilidad con NOM-012-SCT-2-2017 / ISO 14001 y como mejorar.
  `;

  try {
    // Call generateContent with both model name and prompt
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "Eres un experto en logistica sustentable, eficiencia de cubica, seguridad de carga y reduccion de consumo de combustibles fosiles. Analiza planes de carga y entrega recomendaciones profesionales, concretas y verificables.",
        temperature: 0.7,
      }
    });

    // Access the .text property directly (property, not a method)
    return response.text || "No advice could be generated at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "No se pudo generar el analisis de IA en este momento. Verifica tu API key y revisa la carga manualmente.";
  }
};
