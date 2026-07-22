/**
 * Defines schema-backed domain models with separate database and JSON shapes.
 *
 * A model keeps one field declaration as the source of truth and derives variants for selecting,
 * inserting, updating, and JSON encoding. This is useful when the database shape is not exactly the
 * same as the public API shape, such as generated ids, audit timestamps, nullable columns, private
 * fields, or values that need different encodings at different boundaries. Each generated variant
 * is its own schema, so callers can validate or encode the shape that matches the operation they
 * are performing.
 *
 * @since 4.0.0
 */
import * as Uuid from "uuid";
import type { Brand } from "../../Brand.ts";
import * as DateTime from "../../DateTime.ts";
import * as Effect from "../../Effect.ts";
import * as Option from "../../Option.ts";
import * as Predicate from "../../Predicate.ts";
import * as Schema from "../../Schema.ts";
import * as SchemaGetter from "../../SchemaGetter.ts";
import * as SchemaTransformation from "../../SchemaTransformation.ts";
import * as VariantSchema from "./VariantSchema.ts";

const { Class, Field, FieldExcept, FieldOnly, Struct, Union, extract, fieldEvolve } =
  VariantSchema.make({
    variants: ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"],
    defaultVariant: "select",
  });

/**
 * Base shape of a variant model schema, including its fields and the generated database and JSON
 * variant schemas.
 *
 * @since 4.0.0
 * @category Models
 */
export type Any = Schema.Top & {
  readonly fields: Schema.Struct.Fields;
  readonly insert: Schema.Top;
  readonly update: Schema.Top;
  readonly json: Schema.Top;
  readonly jsonCreate: Schema.Top;
  readonly jsonUpdate: Schema.Top;
};

/**
 * Database-facing variant names generated for model schemas.
 *
 * @since 4.0.0
 * @category Models
 */
export type VariantsDatabase = "select" | "insert" | "update";

/**
 * JSON API-facing variant names generated for model schemas.
 *
 * @since 4.0.0
 * @category Models
 */
export type VariantsJson = "json" | "jsonCreate" | "jsonUpdate";

export {
  /**
   * Creates domain model schemas with common database and JSON API variants.
   *
   * **Example** (Defining a variant model class)
   *
   * ```ts
   * import { Schema } from "effect";
   * import { Model } from "effect/unstable/schema";
   *
   * export const GroupId = Schema.Number.pipe(Schema.brand("GroupId"));
   *
   * export class Group extends Model.Class<Group>("Group")({
   *   id: Model.GeneratedByDb(GroupId),
   *   name: Schema.String,
   *   createdAt: Model.DateTimeInsertFromDate,
   *   updatedAt: Model.DateTimeUpdateFromDate,
   * }) {}
   *
   * // schema used for selects
   * Group;
   *
   * // schema used for inserts
   * Group.insert;
   *
   * // schema used for updates
   * Group.update;
   *
   * // schema used for json api
   * Group.json;
   * Group.jsonCreate;
   * Group.jsonUpdate;
   *
   * // you can also turn them into classes
   * class GroupJson extends Schema.Class<GroupJson>("GroupJson")(Group.json) {
   *   get upperName() {
   *     return this.name.toUpperCase();
   *   }
   * }
   * ```
   *
   * @since 4.0.0
   * @category Constructors
   */
  Class,
  /**
   * Extracts a generated variant schema from a model or variant struct.
   *
   * @since 4.0.0
   * @category Extraction
   */
  extract,
  /**
   * Creates a variant field from schemas keyed by variant name.
   *
   * @since 4.0.0
   * @category Fields
   */
  Field,
  /**
   * Transforms schemas inside a variant field or plain schema by variant name.
   *
   * @since 4.0.0
   * @category Fields
   */
  fieldEvolve,
  /**
   * Creates a variant field that applies a schema to every variant except the supplied keys.
   *
   * @since 4.0.0
   * @category Fields
   */
  FieldExcept,
  /**
   * Creates a variant field that applies a schema only to the supplied variants.
   *
   * @since 4.0.0
   * @category Fields
   */
  FieldOnly,
  /**
   * Creates a variant struct from model field definitions.
   *
   * @since 4.0.0
   * @category Constructors
   */
  Struct,
  /**
   * Creates a union over the default and generated variant schemas of multiple variant structs.
   *
   * @since 4.0.0
   * @category Constructors
   */
  Union,
};

/**
 * Returns the variant field definitions stored on a model or variant struct.
 *
 * @since 4.0.0
 * @category Fields
 */
export const fields: <A extends VariantSchema.Struct<any>>(
  self: A,
) => A[typeof VariantSchema.TypeId] = VariantSchema.fields;

/**
 * Marks a value as an explicit override for fields that otherwise use an overrideable default.
 *
 * @since 4.0.0
 * @category Overrideable
 */
export const Override: <A>(value: A) => A & Brand<"Override"> = VariantSchema.Override;

/**
 * Variant field type for a database-generated column that is present in read variants only.
 *
 * **Details**
 *
 * The field is included in `select` and `json`, and omitted from `insert`, `update`, `jsonCreate`,
 * and `jsonUpdate`.
 *
 * @since 4.0.0
 * @category Generated
 * @see {@link Field} for generated columns that need a custom variant set, such
 * as primary keys used in update payloads.
 */
export interface GeneratedByDb<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S;
  readonly json: S;
}> {}

/**
 * Creates a variant field for a database-generated column available in read variants only.
 *
 * **Details**
 *
 * The field is included in `select` and `json`, and omitted from `insert`, `update`, `jsonCreate`,
 * and `jsonUpdate`.
 *
 * @since 4.0.0
 * @category Generated
 * @see {@link Field} for generated columns that need a custom variant set, such
 * as primary keys used in update payloads.
 */
export const GeneratedByDb = <S extends Schema.Top>(schema: S): GeneratedByDb<S> =>
  Field({
    select: schema,
    json: schema,
  });

/**
 * Variant field type for an application-generated value that is present in database variants and
 * read JSON, but omitted from JSON create and update variants.
 *
 * @since 4.0.0
 * @category Generated
 */
export interface GeneratedByApp<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S;
  readonly insert: S;
  readonly update: S;
  readonly json: S;
}> {}

/**
 * A field that represents a value generated by the application and present in database variants and
 * the read JSON variant, but omitted from JSON create and update variants.
 *
 * @since 4.0.0
 * @category Generated
 */
export const GeneratedByApp = <S extends Schema.Top>(schema: S): GeneratedByApp<S> =>
  Field({
    select: schema,
    insert: schema,
    update: schema,
    json: schema,
  });

/**
 * Variant field type for a sensitive value that is available to database variants and omitted from
 * all JSON variants.
 *
 * @since 4.0.0
 * @category Sensitive
 */
export interface Sensitive<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S;
  readonly insert: S;
  readonly update: S;
}> {}

/**
 * A field that represents a sensitive value that should not be exposed in the JSON variants.
 *
 * @since 4.0.0
 * @category Sensitive
 */
export const Sensitive = <S extends Schema.Top>(schema: S): Sensitive<S> =>
  Field({
    select: schema,
    insert: schema,
    update: schema,
  });

/**
 * Schema type for an optional object key whose encoded value may be missing or null and whose
 * decoded value is an `Option`.
 *
 * @since 4.0.0
 * @category Optional
 */
export interface optionalOption<S extends Schema.Constraint> extends Schema.decodeTo<
  Schema.Option<Schema.toType<S>>,
  Schema.optionalKey<Schema.NullOr<S>>
> {}

/**
 * Creates a schema for optional keys that decodes missing or null encoded values through `Option`
 * and encodes `Option` values back to optional nullable keys.
 *
 * @since 4.0.0
 * @category Optional
 */
export const optionalOption = <S extends Schema.Constraint>(schema: S): optionalOption<S> =>
  Schema.optionalKey(Schema.NullOr(schema)).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.toType(schema)),
      SchemaTransformation.transformOptional<Option.Option<S["Type"]>, S["Type"] | null>({
        decode: (oe) => oe.pipe(Option.filter(Predicate.isNotNull), Option.some),
        encode: Option.flatten,
      }) as any,
    ),
  );

/**
 * Convert a field to one that is optional for all variants.
 *
 * **Details**
 *
 * For the database variants, it will accept `null`able values. For the JSON variants, it will also
 * accept missing keys.
 *
 * @since 4.0.0
 * @category Optional
 */
export interface FieldOption<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: Schema.OptionFromNullOr<S>;
  readonly insert: Schema.OptionFromNullOr<S>;
  readonly update: Schema.OptionFromNullOr<S>;
  readonly json: optionalOption<S>;
  readonly jsonCreate: optionalOption<S>;
  readonly jsonUpdate: optionalOption<S>;
}> {}

/**
 * Converts a field to one that is optional for all variants.
 *
 * **Details**
 *
 * For the database variants, it will accept `null`able values. For the JSON variants, it will also
 * accept missing keys.
 *
 * @since 4.0.0
 * @category Optional
 */
export const FieldOption: <Field extends VariantSchema.Field<any> | Schema.Top>(
  self: Field,
) => Field extends Schema.Top
  ? FieldOption<Field>
  : Field extends VariantSchema.Field<infer S>
    ? VariantSchema.Field<{
        readonly [K in keyof S]: S[K] extends Schema.Top
          ? K extends VariantsDatabase
            ? Schema.OptionFromNullOr<S[K]>
            : optionalOption<S[K]>
          : never;
      }>
    : never = fieldEvolve({
  select: Schema.OptionFromNullOr,
  insert: Schema.OptionFromNullOr,
  update: Schema.OptionFromNullOr,
  json: optionalOption,
  jsonCreate: optionalOption,
  jsonUpdate: optionalOption,
}) as any;

/**
 * Variant field type for SQLite booleans stored as `0 | 1` in database variants and exposed as
 * `boolean` in JSON variants.
 *
 * @since 4.0.0
 * @category Booleans
 */
export interface BooleanSqlite extends VariantSchema.Field<{
  readonly select: Schema.BooleanFromBit;
  readonly insert: Schema.BooleanFromBit;
  readonly update: Schema.BooleanFromBit;
  readonly json: Schema.Boolean;
  readonly jsonCreate: Schema.Boolean;
  readonly jsonUpdate: Schema.Boolean;
}> {}

/**
 * Schema for sqlite booleans that are represented as `0 | 1` in database variants and `boolean` in
 * JSON variants.
 *
 * @since 4.0.0
 * @category Booleans
 */
export const BooleanSqlite: BooleanSqlite = Field({
  select: Schema.BooleanFromBit,
  insert: Schema.BooleanFromBit,
  update: Schema.BooleanFromBit,
  json: Schema.Boolean,
  jsonCreate: Schema.Boolean,
  jsonUpdate: Schema.Boolean,
});

/**
 * Schema type for a `DateTime.Utc` date-only value encoded as a `YYYY-MM-DD` string.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface Date extends Schema.decodeTo<Schema.instanceOf<DateTime.Utc>, Schema.String> {}

/**
 * Schema for a `DateTime.Utc` that is serialized as a date string in the format `YYYY-MM-DD`.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const Date: Date = Schema.String.pipe(
  Schema.decodeTo(Schema.DateTimeUtc, {
    decode: SchemaGetter.dateTimeUtcFromInput().map(DateTime.removeTime),
    encode: SchemaGetter.transform(DateTime.formatIsoDate),
  }),
);

/**
 * Schema for an overrideable UTC date-only field whose constructor default is the current date with
 * the time component removed.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateWithNow = VariantSchema.Overrideable(Date, {
  defaultValue: Effect.map(DateTime.now, DateTime.removeTime),
});

/**
 * Schema for an overrideable UTC date-time field encoded as a string and defaulted to the current
 * `DateTime.Utc`.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromString, {
  defaultValue: DateTime.now,
});

/**
 * Schema for an overrideable UTC date-time field encoded as a JavaScript `Date` and defaulted to
 * the current `DateTime.Utc`.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeFromDateWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromDate, {
  defaultValue: DateTime.now,
});

/**
 * Schema for an overrideable UTC date-time field encoded as milliseconds and defaulted to the
 * current `DateTime.Utc`.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeFromNumberWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromMillis, {
  defaultValue: DateTime.now,
});

/**
 * Variant field type for a UTC date-time stored as a string, defaulted to the current time on
 * insert, available for selection, and omitted from updates.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeInsert extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromString;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>;
  readonly json: Schema.DateTimeUtcFromString;
}> {}

/**
 * A field that represents a date-time value that is inserted as the current `DateTime.Utc`. It is
 * serialized as a string for the database.
 *
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeInsert: DateTimeInsert = Field({
  select: Schema.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  json: Schema.DateTimeUtcFromString,
});

/**
 * Variant field type for a UTC date-time stored as a JavaScript `Date` in database variants,
 * encoded as a string for JSON, and defaulted on insert.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeInsertFromDate extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromDate;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>;
  readonly json: Schema.DateTimeUtcFromString;
}> {}

/**
 * A field that represents a date-time value that is inserted as the current `DateTime.Utc`. It is
 * serialized as a `Date` for the database.
 *
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeInsertFromDate: DateTimeInsertFromDate = Field({
  select: Schema.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  json: Schema.DateTimeUtcFromString,
});

/**
 * Variant field type for a UTC date-time encoded as milliseconds and defaulted to the current time
 * on insert.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeInsertFromNumber extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromMillis;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>;
  readonly json: Schema.DateTimeUtcFromMillis;
}> {}

/**
 * A field that represents a date-time value that is inserted as the current `DateTime.Utc`. It is
 * serialized as a `number`.
 *
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeInsertFromNumber: DateTimeInsertFromNumber = Field({
  select: Schema.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  json: Schema.DateTimeUtcFromMillis,
});

/**
 * Variant field type for a UTC date-time stored as a string and defaulted to the current time on
 * both inserts and updates.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeUpdate extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromString;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>;
  readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>;
  readonly json: Schema.DateTimeUtcFromString;
}> {}

/**
 * A field that represents a date-time value that is updated as the current `DateTime.Utc`. It is
 * serialized as a string for the database.
 *
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeUpdate: DateTimeUpdate = Field({
  select: Schema.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  update: DateTimeWithNow,
  json: Schema.DateTimeUtcFromString,
});

/**
 * Variant field type for a UTC date-time stored as a JavaScript `Date` in database variants,
 * encoded as a string for JSON, and defaulted on inserts and updates.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeUpdateFromDate extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromDate;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>;
  readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>;
  readonly json: Schema.DateTimeUtcFromString;
}> {}

/**
 * A field that represents a date-time value that is updated as the current `DateTime.Utc`. It is
 * serialized as a `Date` for the database.
 *
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeUpdateFromDate: DateTimeUpdateFromDate = Field({
  select: Schema.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  update: DateTimeFromDateWithNow,
  json: Schema.DateTimeUtcFromString,
});

/**
 * Variant field type for a UTC date-time encoded as milliseconds and defaulted to the current time
 * on both inserts and updates.
 *
 * @since 4.0.0
 * @category DateTime
 */
export interface DateTimeUpdateFromNumber extends VariantSchema.Field<{
  readonly select: Schema.DateTimeUtcFromMillis;
  readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>;
  readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>;
  readonly json: Schema.DateTimeUtcFromMillis;
}> {}

/**
 * A field that represents a date-time value that is updated as the current `DateTime.Utc`. It is
 * serialized as a `number`.
 *
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is available for selection.
 *
 * @since 4.0.0
 * @category DateTime
 */
export const DateTimeUpdateFromNumber: DateTimeUpdateFromNumber = Field({
  select: Schema.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  update: DateTimeFromNumberWithNow,
  json: Schema.DateTimeUtcFromMillis,
});

/**
 * Variant field type for a JSON value stored as text in database variants and exposed through the
 * supplied schema in JSON variants.
 *
 * @since 4.0.0
 * @category Models
 */
export interface JsonFromString<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: Schema.fromJsonString<S>;
  readonly insert: Schema.fromJsonString<S>;
  readonly update: Schema.fromJsonString<S>;
  readonly json: S;
  readonly jsonCreate: S;
  readonly jsonUpdate: S;
}> {}

/**
 * A field that represents a JSON value stored as text in the database.
 *
 * **Details**
 *
 * The "json" variants will use the object schema directly.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const JsonFromString = <S extends Schema.Top>(schema: S): JsonFromString<S> => {
  const parsed = Schema.fromJsonString(Schema.toCodecJson(schema)) as any;
  return Field({
    select: parsed,
    insert: parsed,
    update: parsed,
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};

/**
 * Variant field type for a branded binary UUID v4 value whose insert variant generates a UUID by
 * default.
 *
 * @since 4.0.0
 * @category Uuid
 */
export interface UuidV4BytesInsert<B extends string> extends VariantSchema.Field<{
  readonly select: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>;
  readonly insert: Schema.withConstructorDefault<
    Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
  >;
  readonly update: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>;
  readonly json: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>;
}> {}

/**
 * Schema for binary `Uint8Array` values backed by an `ArrayBuffer`.
 *
 * @since 4.0.0
 * @category Uint8Array
 */
export const Uint8Array: Schema.instanceOf<Uint8Array<ArrayBuffer>> =
  Schema.Uint8Array as Schema.instanceOf<globalThis.Uint8Array<ArrayBuffer>>;

/**
 * Adds a constructor default that generates a binary UUID v4 for a branded `Uint8Array` schema.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV4BytesWithGenerate = <B extends string>(
  schema: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>,
): Schema.withConstructorDefault<Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>> =>
  schema.pipe(
    Schema.withConstructorDefault(Effect.sync(() => Uuid.v4({}, new globalThis.Uint8Array(16)))),
  );

/**
 * A field that represents a binary UUID v4 that is generated on inserts.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV4BytesInsert = <const B extends string>(
  schema: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>,
): UuidV4BytesInsert<B> =>
  Field({
    select: schema,
    insert: UuidV4BytesWithGenerate(schema),
    update: schema,
    json: schema,
  });

/**
 * Variant field type for a branded string UUID v4 value whose insert variant generates a UUID by
 * default.
 *
 * @since 4.0.0
 * @category Uuid
 */
export interface UuidV4Insert<B extends string> extends VariantSchema.Field<{
  readonly select: Schema.brand<Schema.String, B>;
  readonly insert: Schema.withConstructorDefault<Schema.brand<Schema.String, B>>;
  readonly update: Schema.brand<Schema.String, B>;
  readonly json: Schema.brand<Schema.String, B>;
}> {}

/**
 * Adds a constructor default that generates a string UUID v4.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV4WithGenerate = <B extends string>(
  schema: Schema.brand<Schema.String, B>,
): Schema.withConstructorDefault<Schema.brand<Schema.String, B>> =>
  schema.pipe(Schema.withConstructorDefault(Effect.sync(() => Uuid.v4())));

/**
 * A field that represents a string UUID v4 that is generated on inserts.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV4Insert = <const B extends string>(
  schema: Schema.brand<Schema.String, B>,
): UuidV4Insert<B> =>
  Field({
    select: schema,
    insert: UuidV4WithGenerate(schema),
    update: schema,
    json: schema,
  });

/**
 * Variant field type for a branded string UUID v7 value whose insert variant generates a UUID by
 * default.
 *
 * @since 4.0.0
 * @category Uuid
 */
export interface UuidV7Insert<B extends string> extends VariantSchema.Field<{
  readonly select: Schema.brand<Schema.String, B>;
  readonly insert: Schema.withConstructorDefault<Schema.brand<Schema.String, B>>;
  readonly update: Schema.brand<Schema.String, B>;
  readonly json: Schema.brand<Schema.String, B>;
}> {}

/**
 * Adds a constructor default that generates a string UUID v7.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV7WithGenerate = <B extends string>(
  schema: Schema.brand<Schema.String, B>,
): Schema.withConstructorDefault<Schema.brand<Schema.String, B>> =>
  schema.pipe(
    Schema.withConstructorDefault(
      Effect.clockWith((clock) =>
        Effect.succeed(
          Uuid.v7({
            msecs: clock.currentTimeMillisUnsafe(),
          }),
        ),
      ),
    ),
  );

/**
 * A field that represents a string UUID v7 that is generated on inserts.
 *
 * @since 4.0.0
 * @category Uuid
 */
export const UuidV7Insert = <const B extends string>(
  schema: Schema.brand<Schema.String, B>,
): UuidV7Insert<B> =>
  Field({
    select: schema,
    insert: UuidV7WithGenerate(schema),
    update: schema,
    json: schema,
  });
