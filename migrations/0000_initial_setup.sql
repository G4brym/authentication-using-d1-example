-- Migration number: 0000 	 2023-06-23T18:27:14.127Z

create table users
(
    id       integer primary key autoincrement,
    email    text not null unique,
    password text not null,
    name     text not null
);

create table users_sessions
(
    session_id integer primary key autoincrement,
    user_id    integer not null
        constraint users_sessions_users_id_fk
            references users
            on update cascade on delete cascade,
    token      text not null,
    expires_at integer    not null
);
