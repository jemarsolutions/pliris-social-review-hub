CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_versions BEFORE UPDATE OR DELETE ON platform_variant_versions FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_decisions BEFORE UPDATE OR DELETE ON review_decisions FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_version_media BEFORE UPDATE OR DELETE ON platform_variant_media FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_media BEFORE UPDATE OR DELETE ON media_assets FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_comments BEFORE UPDATE OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_publishing BEFORE UPDATE OR DELETE ON publishing_records FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
ALTER TABLE platform_variant_versions ADD CONSTRAINT version_identity UNIQUE(id, platform_variant_id);
--> statement-breakpoint
ALTER TABLE platform_variants ADD CONSTRAINT current_version_ownership FOREIGN KEY (current_version_id, id) REFERENCES platform_variant_versions(id, platform_variant_id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE review_decisions ADD CONSTRAINT decision_version_ownership FOREIGN KEY(version_id, platform_variant_id) REFERENCES platform_variant_versions(id, platform_variant_id);
--> statement-breakpoint
ALTER TABLE comments ADD CONSTRAINT comment_version_ownership FOREIGN KEY(version_id, platform_variant_id) REFERENCES platform_variant_versions(id, platform_variant_id);
--> statement-breakpoint
ALTER TABLE platform_variant_media ADD CONSTRAINT media_version_ownership FOREIGN KEY(version_id, platform_variant_id) REFERENCES platform_variant_versions(id, platform_variant_id);
--> statement-breakpoint
ALTER TABLE publishing_records ADD CONSTRAINT publishing_version_ownership FOREIGN KEY(version_id, platform_variant_id) REFERENCES platform_variant_versions(id, platform_variant_id);
--> statement-breakpoint
ALTER TABLE review_decisions ADD CONSTRAINT decision_values CHECK(decision IN ('APPROVED','CHANGES_REQUESTED','REJECTED'));
--> statement-breakpoint
ALTER TABLE review_decisions ADD CONSTRAINT feedback_required CHECK(decision='APPROVED' OR length(trim(reason)) > 0);
--> statement-breakpoint
CREATE INDEX variants_planned_date ON platform_variants(planned_publish_at);
--> statement-breakpoint
CREATE INDEX variants_review_queue ON platform_variants(review_status, planned_publish_at);
--> statement-breakpoint
CREATE INDEX audit_entity ON audit_events(entity_id, created_at);
