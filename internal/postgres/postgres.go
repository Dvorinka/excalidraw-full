package postgres

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"strconv"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type DB struct {
	*sql.DB
}

type Tx struct {
	*sql.Tx
}

func Open(databaseURL string) (*DB, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	return &DB{DB: db}, nil
}

func Migrate(ctx context.Context, db *sql.DB) error {
	goose.SetBaseFS(migrationFS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, db, "migrations")
}

func (db *DB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return db.DB.ExecContext(ctx, Rebind(query), args...)
}

func (db *DB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return db.DB.QueryContext(ctx, Rebind(query), args...)
}

func (db *DB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return db.DB.QueryRowContext(ctx, Rebind(query), args...)
}

func (db *DB) BeginTx(ctx context.Context, opts *sql.TxOptions) (*Tx, error) {
	tx, err := db.DB.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &Tx{Tx: tx}, nil
}

func (tx *Tx) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return tx.Tx.ExecContext(ctx, Rebind(query), args...)
}

func (tx *Tx) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return tx.Tx.QueryContext(ctx, Rebind(query), args...)
}

func (tx *Tx) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return tx.Tx.QueryRowContext(ctx, Rebind(query), args...)
}

func Rebind(query string) string {
	out := make([]byte, 0, len(query)+8)
	arg := 1
	inSingle := false
	inDouble := false
	for i := 0; i < len(query); i++ {
		ch := query[i]
		switch ch {
		case '\'':
			out = append(out, ch)
			if !inDouble {
				if inSingle && i+1 < len(query) && query[i+1] == '\'' {
					i++
					out = append(out, query[i])
					continue
				}
				inSingle = !inSingle
			}
		case '"':
			out = append(out, ch)
			if !inSingle {
				inDouble = !inDouble
			}
		case '?':
			if inSingle || inDouble {
				out = append(out, ch)
				continue
			}
			out = append(out, '$')
			out = strconv.AppendInt(out, int64(arg), 10)
			arg++
		default:
			out = append(out, ch)
		}
	}
	return string(out)
}
