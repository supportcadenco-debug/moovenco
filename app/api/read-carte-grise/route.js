export async function POST(request) {
  try {
    const { pdfBase64 } = await request.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: `Lis cette carte grise française et extrais les informations suivantes.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans backticks, sans markdown.
{
  "plate": "immatriculation (format AA-123-BB)",
  "brand": "marque du véhicule en majuscules",
  "model": "modèle",
  "year": "année de première mise en circulation (4 chiffres)",
  "seats": "nombre de places assises (chiffre uniquement, sans texte)",
  "fuel": "carburant parmi : Diesel, Essence, Électrique, Hybride, GNV",
  "type": "type parmi : Autocar, Autobus, Minibus, Véhicule léger, Utilitaire"
}
Si une information est absente ou illisible, mets une chaîne vide "".`
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return Response.json({ success: false, error: `API error ${response.status}: ${err}` }, { status: 500 })
    }

    const data = await response.json()
    const rawText = data.content?.map(c => c.text || '').join('').trim()

    if (!rawText) {
      return Response.json({ success: false, error: 'Réponse vide de Claude' }, { status: 500 })
    }

    // Extraire le JSON même si du texte l'entoure
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ success: false, error: 'Impossible de trouver le JSON dans la réponse : ' + rawText }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({ success: true, data: parsed })

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 })
  }
}