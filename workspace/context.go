package workspace

import "context"

type currentSession struct {
	user    *User
	session *Session
}

func withUser(ctx context.Context, user *User, session *Session) context.Context {
	return context.WithValue(ctx, currentUserKey, currentSession{user: user, session: session})
}

func currentUser(r interface{ Context() context.Context }) (*User, *Session) {
	current, _ := r.Context().Value(currentUserKey).(currentSession)
	return current.user, current.session
}
