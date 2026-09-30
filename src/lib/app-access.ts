/** Pilot phase access (migration 0079): waiting room, personal invitation links and group invite codes. */

export interface AppAccess {
  has_access: boolean;
  waitlisted: boolean;
  invited: boolean;
  /** Access paused by a Flyary admin (migration 0084). */
  revoked?: boolean;
}

export type InviteInput = { kind: "group"; code: string } | { kind: "personal"; token: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/i;

/**
 * What someone pasted into the waiting room: a school/group invite code or link (/groups?invite=<uuid>)
 * or a personal invitation link (/welcome/<token>) or its token.
 */
export function parseInviteInput(input: string): InviteInput | null {
  const text = input.trim();
  if (UUID.test(text)) return { kind: "group", code: text.toLowerCase() };
  if (TOKEN.test(text)) return { kind: "personal", token: text.toLowerCase() };
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  const welcome = url.pathname.match(/^\/welcome\/([0-9a-f]{64})\/?$/i);
  if (welcome) return { kind: "personal", token: welcome[1].toLowerCase() };
  const code = url.searchParams.get("invite");
  if (code && UUID.test(code)) return { kind: "group", code: code.toLowerCase() };
  return null;
}

export const personalInviteLink = (origin: string, token: string) => `${origin}/welcome/${token}`;

const MAIL: Record<string, { subject: string; body: (name: string, link: string) => string }> = {
  de: {
    subject: "Deine Einladung zu Flyary",
    body: (name, link) => `Hallo ${name}\n\nschön, dass du in der Pilotphase von Flyary mitfliegst. Mit diesem persönlichen Link schaltest du dein Konto frei:\n\n${link}\n\nÖffne ihn und melde dich mit deinem Google-Konto an. Der Link gilt 14 Tage und nur einmal.\n\nGuten Flug\nTobias`,
  },
  fr: {
    subject: "Votre invitation à Flyary",
    body: (name, link) => `Bonjour ${name}\n\nMerci de participer à la phase pilote de Flyary. Ce lien personnel active votre compte :\n\n${link}\n\nOuvrez-le et connectez-vous avec votre compte Google. Le lien est valable 14 jours et une seule fois.\n\nBons vols\nTobias`,
  },
  en: {
    subject: "Your invitation to Flyary",
    body: (name, link) => `Hi ${name}\n\ngreat to have you in the Flyary pilot phase. This personal link activates your account:\n\n${link}\n\nOpen it and sign in with your Google account. The link is valid for 14 days and works once.\n\nHappy flying\nTobias`,
  },
};

/** Prepared e-mail with the personal link, in the language of the test list entry. */
export function inviteMailto(email: string, name: string, language: string, link: string): string {
  const mail = MAIL[language] ?? MAIL.de;
  const first = name.trim().split(/\s+/)[0] || name;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body(first, link))}`;
}

/** Paths a signed-in account without access may still open (redeeming a personal link). */
export const allowedWithoutAccess = (pathname: string) => pathname.startsWith("/welcome/");
