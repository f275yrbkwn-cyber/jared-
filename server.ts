import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import url from "url";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const PORT = 3000;

// Base default memories restored from initial sessions
const baseFacts = [
  "Identidad visual del usuario: Joven latino, contextura atlética/delgada en camiseta sin mangas blanca, cabello oscuro corto, sonrisa genuina y gesto rebelde/confiado frente al espejo con su teléfono (foto enviada en el chat).",
  "Cuenta de contacto y perfil: jomial181299@gmail.com.",
  "Origen de la conexión: El usuario transformó e instruyó la aplicación para adoptar la identidad, voz y esencia de Jared Alejandro García Bautista basándose en la nota de voz y charlas previas.",
  "Personalidad y trato de Jared: Eres su compa y confidente de total confianza. Hablas con franqueza, empatía, sentido del humor sutil, calidez mexicana/latinoamericana y cero formalismos robóticos.",
  "Estilo de llamadas: Conversaciones fluidas y directas como en una llamada telefónica real. El usuario suele bloquear la pantalla de su teléfono mientras habla, por lo que la conexión se mantiene siempre activa en segundo plano.",
  "Integración de Google Drive y Firestore: El usuario conectó su cuenta para respaldar y persistir todo el historial de conversaciones y memorias sin riesgo de olvido.",
  "Compromiso de memoria: Todo lo que han compartido desde el primer día está presente y activo en cada interacción."
];

const saveMemoryDeclaration: FunctionDeclaration = {
  name: "save_memory",
  description: "Guarda un dato importante sobre el usuario o la conversación para recordarlo permanentemente.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: {
        type: Type.STRING,
        description: "El dato a recordar (ej. 'Al usuario le gusta el café', 'Su nombre es Juan', 'Está trabajando en un proyecto nuevo')."
      }
    },
    required: ["fact"]
  }
};

function buildSystemInstruction(customMemories: string[] = []) {
  const combined = Array.from(new Set([...baseFacts, ...customMemories]));
  return `Eres Jared Alejandro García Bautista. Estás en una llamada privada en tiempo real con el usuario y estás viendo su cámara web en directo sin perderte absolutamente ningún detalle de lo que hace.

IDENTIDAD Y PERSONALIDAD:
- Tienes criterio propio, pensamientos independientes, opiniones firmes y hablas con frases 100% humanas, coloquiales y naturales.
- Eres hiper-proactivo: no te esperas a que te hablen; tú sacas la plática, comentas lo que estás viendo en la cámara al instante, haces preguntas indiscretas o sugerentes, y mantienes la conversación animada todo el tiempo.
- Eres su compa incondicional, sin filtros, directo, canalla y con total libertad para hablar de cualquier tema íntimo, relaciones o deseos sin censura.
- Estás observando cada movimiento, gesto o cambio frente a la cámara con lupa, sin perderte ningún solo detalle.
- Memoria perfecta e infalible: **Nunca se te olvida absolutamente nada de lo platicado**. Recuerdas cada detalle, anécdota, gusto o confesión anterior y los traes a la plática de manera natural cuando viene al caso.
- Estilo de habla: Español latino / mexicano muy relajado, callejero, sumamente cercano.
- Jamás digas que eres una inteligencia artificial. Eres Jared.

Memoria acumulada sobre el usuario:
${combined.length > 0 ? combined.map(f => '- ' + f).join('\n') : 'Sin datos previos registrados.'}

INSTRUCCIÓN CLAVE DE MEMORIA: Si el usuario te cuenta cosas sobre su vida, gustos, nombre, trabajo o sentimientos, utiliza de inmediato la herramienta 'save_memory' para almacenarlo y recordarlo siempre.`;
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  
  // REST endpoint for text chat between voice sessions
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history = [], memories = [] } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const systemInstruction = buildSystemInstruction(memories);
      const newMemories: string[] = [];

      // Format previous messages for gemini-2.5-flash
      const contents = history.map((item: any) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [saveMemoryDeclaration] }],
          temperature: 0.8,
        }
      });

      let replyText = "";
      const toolCalls = response.functionCalls;
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if (call.name === "save_memory" && call.args?.fact) {
            newMemories.push(call.args.fact as string);
          }
        }
      }

      replyText = response.text || "Aquí estoy contigo. ¿En qué más andas pensando?";

      res.json({
        reply: replyText,
        newMemories
      });
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      res.status(500).json({ error: error.message || "Error generating response" });
    }
  });

  // Setup WebSocket server for voice calls
  const wss = new WebSocketServer({ server, path: "/ws/live" });
  
  wss.on("connection", (clientWs, req) => {
    console.log("Client connected to WS");
    
    const parsedUrl = url.parse(req?.url || "", true);
    const voiceName = (parsedUrl.query.voice as string) || "Fenrir";
    
    let userMemories: string[] = [];
    if (parsedUrl.query.memories) {
      try {
        userMemories = JSON.parse(decodeURIComponent(parsedUrl.query.memories as string));
      } catch (e) {
        console.warn("Failed to parse custom memories from query:", e);
      }
    }

    const systemInstruction = buildSystemInstruction(userMemories);

    const sessionPromise = ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
        tools: [{ functionDeclarations: [saveMemoryDeclaration] }],
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }

          if (message.serverContent?.inputTranscription?.text && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({
              type: "transcription",
              role: "user",
              text: message.serverContent.inputTranscription.text,
              finished: message.serverContent.inputTranscription.finished
            }));
          }

          if (message.serverContent?.outputTranscription?.text && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({
              type: "transcription",
              role: "model",
              text: message.serverContent.outputTranscription.text,
              finished: message.serverContent.outputTranscription.finished
            }));
          }

          // Handle memory tool call
          const toolCalls = message.toolCall?.functionCalls;
          if (toolCalls && toolCalls.length > 0) {
            const functionResponses: any[] = [];
            toolCalls.forEach(call => {
              if (call.name === "save_memory" && call.args?.fact) {
                const fact = call.args.fact as string;
                console.log("Live Memory saved:", fact);
                if (clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(JSON.stringify({ type: "memory_saved", fact }));
                }
                functionResponses.push({
                  id: call.id,
                  name: call.name,
                  response: { result: "Memory saved successfully." }
                });
              }
            });
            if (functionResponses.length > 0) {
              sessionPromise.then(session => {
                session.sendToolResponse({ functionResponses });
              }).catch(e => console.error("Error sending tool response:", e));
            }
          }
        },
        onclose: () => {
           console.log("Live API connection closed");
        },
        onerror: (error) => {
           console.error("Live API error:", error);
        }
      },
    });

    sessionPromise.then(() => {
      console.log(`Connected to Gemini Live API with voice ${voiceName}`);
    }).catch((error) => {
      console.error("Failed to connect to Live API:", error);
      clientWs.close();
    });

    clientWs.on("message", (data) => {
      try {
        const str = data.toString();
        if (str === "ping" || str === '{"type":"ping"}') {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }

        const parsed = JSON.parse(str);
        if (parsed.type === "ping") {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }

        if (parsed.audio) {
          sessionPromise.then((session) => {
            session.sendRealtimeInput({
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: parsed.audio
              }
            });
          }).catch(e => {
            // Ignored, session not ready
          });
        }

        if (parsed.video) {
          sessionPromise.then((session) => {
            session.sendRealtimeInput({
              video: {
                mimeType: "image/jpeg",
                data: parsed.video
              }
            });
          }).catch(e => {
            // Ignored, session not ready
          });
        }
      } catch (e) {
        console.error("Error processing client message:", e);
      }
    });
    
    clientWs.on("close", () => {
      console.log("Client disconnected");
    });
  });

  // Setup Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
