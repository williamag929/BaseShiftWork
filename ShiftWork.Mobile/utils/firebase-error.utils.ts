/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Centralised here so all screens share the same copy and new codes are
 * added in a single place.
 */
export function getFirebaseAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'Invalid email or password';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      return 'Authentication failed. Please try again.';
  }
}
