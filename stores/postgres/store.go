package postgres

import (
	"bytes"
	"context"
	"database/sql"
	"excalidraw-complete/core"
	dbpostgres "excalidraw-complete/internal/postgres"
	"fmt"
	"log"
	"time"

	"github.com/oklog/ulid/v2"
	"github.com/sirupsen/logrus"
)

type postgresStore struct {
	db *dbpostgres.DB
}

func NewStore(databaseURL string) *postgresStore {
	db, err := dbpostgres.Open(databaseURL)
	if err != nil {
		log.Fatalf("failed to open postgres database: %v", err)
	}
	if err := dbpostgres.Migrate(context.Background(), db.DB); err != nil {
		log.Fatalf("failed to migrate postgres database: %v", err)
	}
	return &postgresStore{db: db}
}

func (s *postgresStore) FindID(ctx context.Context, id string) (*core.Document, error) {
	log := logrus.WithField("document_id", id)
	var data []byte
	err := s.db.QueryRowContext(ctx, "SELECT data FROM documents WHERE id = ?", id).Scan(&data)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("document with id %s not found", id)
		}
		log.WithError(err).Error("failed to retrieve document")
		return nil, err
	}
	return &core.Document{Data: *bytes.NewBuffer(data)}, nil
}

func (s *postgresStore) Create(ctx context.Context, document *core.Document) (string, error) {
	id := ulid.Make().String()
	data := document.Data.Bytes()
	_, err := s.db.ExecContext(ctx, "INSERT INTO documents (id, data) VALUES (?, ?)", id, data)
	if err != nil {
		logrus.WithError(err).WithField("document_id", id).Error("failed to create document")
		return "", err
	}
	return id, nil
}

func (s *postgresStore) List(ctx context.Context, userID string) ([]*core.Canvas, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id, name, updated_at, thumbnail FROM canvases WHERE user_id = ? ORDER BY updated_at DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	canvases := []*core.Canvas{}
	for rows.Next() {
		var canvas core.Canvas
		canvas.UserID = userID
		if err := rows.Scan(&canvas.ID, &canvas.Name, &canvas.UpdatedAt, &canvas.Thumbnail); err != nil {
			return nil, err
		}
		canvases = append(canvases, &canvas)
	}
	return canvases, rows.Err()
}

func (s *postgresStore) Get(ctx context.Context, userID, id string) (*core.Canvas, error) {
	var canvas core.Canvas
	canvas.UserID = userID
	canvas.ID = id
	err := s.db.QueryRowContext(ctx, "SELECT name, data, created_at, updated_at, thumbnail FROM canvases WHERE user_id = ? AND id = ?", userID, id).Scan(&canvas.Name, &canvas.Data, &canvas.CreatedAt, &canvas.UpdatedAt, &canvas.Thumbnail)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("canvas not found")
		}
		return nil, err
	}
	return &canvas, nil
}

func (s *postgresStore) Save(ctx context.Context, canvas *core.Canvas) error {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `INSERT INTO canvases (id, user_id, name, data, created_at, updated_at, thumbnail)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, id) DO UPDATE
		SET name = EXCLUDED.name,
			data = EXCLUDED.data,
			updated_at = EXCLUDED.updated_at,
			thumbnail = EXCLUDED.thumbnail`,
		canvas.ID, canvas.UserID, canvas.Name, canvas.Data, now, now, canvas.Thumbnail,
	)
	return err
}

func (s *postgresStore) Delete(ctx context.Context, userID, id string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM canvases WHERE user_id = ? AND id = ?", userID, id)
	return err
}
