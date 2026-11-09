// Format d'erreur unique : { error: { code, message } }.
// CONFIDENTIALITÉ : les erreurs inattendues sont journalisées sans données de tirage.

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const validationError = (message = 'Requête invalide.') =>
  new AppError(400, 'VALIDATION_ERROR', message);
export const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Tu dois être connecté.');
export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', "Tu n'as pas accès à cette page.");
export const alreadyDrawn = () =>
  new AppError(409, 'ALREADY_DRAWN', 'Tu as déjà effectué ton tirage.');
export const drawImpossible = () =>
  new AppError(500, 'DRAW_IMPOSSIBLE', "Le tirage est impossible. Préviens l'administrateur.");

/** 404 pour toute route /api inconnue. */
export function apiNotFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Ressource introuvable.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let appError = err;
  if (!(err instanceof AppError)) {
    if (err?.type === 'entity.parse.failed') {
      appError = validationError('Le corps de la requête doit être du JSON valide.');
    } else if (err?.type === 'entity.too.large') {
      appError = validationError('Le corps de la requête est trop volumineux.');
    } else {
      // Seuls le nom et la pile sont journalisés : jamais de données de tirage.
      console.error(`Erreur inattendue sur ${req.method} ${req.path} :`, err?.name, err?.stack);
      appError = new AppError(500, 'INTERNAL_ERROR', 'Une erreur inattendue est survenue.');
    }
  }
  res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
}
